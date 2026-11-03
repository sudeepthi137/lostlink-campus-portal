const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware");

const router = express.Router();

router.use(authRequired);

// GET: Messages involving the logged-in user
router.get("/", async (req, res, next) => {
  try {
    const userId = Number(req.user.user_id);

    const [data] = await db.query(
      `SELECT
          m.message_id,
          m.item_id,
          m.claim_id,
          m.sender_id,
          m.recipient_id,
          m.message_text,
          m.read_at,
          m.created_at,
          s.full_name AS sender_name,
          r.full_name AS recipient_name,
          i.item_name
       FROM messages m
       JOIN users s ON s.user_id = m.sender_id
       JOIN users r ON r.user_id = m.recipient_id
       JOIN items i ON i.item_id = m.item_id
       WHERE m.sender_id = ? OR m.recipient_id = ?
       ORDER BY m.created_at DESC`,
      [userId, userId]
    );

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET: Find eligible recipients for an item
router.get("/recipients/:itemId", async (req, res, next) => {
  try {
    const userId = Number(req.user.user_id);
    const itemId = Number(req.params.itemId);

    if (!Number.isInteger(itemId) || itemId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid item ID."
      });
    }

    const [items] = await db.query(
      "SELECT item_id, user_id FROM items WHERE item_id = ?",
      [itemId]
    );

    if (!items.length) {
      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    const ownerId = Number(items[0].user_id);
    let recipients = [];

    if (ownerId === userId) {
      // Item owner can message eligible claimants.
      const [claimants] = await db.query(
        `SELECT DISTINCT u.user_id, u.full_name
         FROM claims c
         JOIN users u ON u.user_id = c.claimant_id
         WHERE c.item_id = ?
           AND u.is_active = 1
           AND c.status IN ('pending', 'approved')
           AND u.user_id != ?`,
        [itemId, userId]
      );

      recipients = claimants;
    } else {
      // Any student can message the owner of the selected item.
      const [owners] = await db.query(
        `SELECT user_id, full_name
         FROM users
         WHERE user_id = ? AND is_active = 1`,
        [ownerId]
      );

      recipients = owners;
    }

    res.json({ success: true, data: recipients });
  } catch (err) {
    next(err);
  }
});

// POST: Send a message
router.post("/", async (req, res, next) => {
  try {
    const userId = Number(req.user.user_id);

    const {
      item_id,
      recipient_id,
      message_text,
      claim_id
    } = req.body || {};

    if (
      !item_id ||
      !recipient_id ||
      !message_text ||
      !message_text.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Item, recipient, and message are required."
      });
    }

    const itemId = Number(item_id);
    const recipientId = Number(recipient_id);

    if (
      !Number.isInteger(itemId) ||
      !Number.isInteger(recipientId) ||
      itemId < 1 ||
      recipientId < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid item or recipient."
      });
    }

    if (recipientId === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot message yourself."
      });
    }

    const [items] = await db.query(
      `SELECT item_id, user_id, item_name
       FROM items
       WHERE item_id = ?`,
      [itemId]
    );

    if (!items.length) {
      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    const ownerId = Number(items[0].user_id);

    const [recipient] = await db.query(
      `SELECT user_id
       FROM users
       WHERE user_id = ? AND is_active = 1`,
      [recipientId]
    );

    if (!recipient.length) {
      return res.status(404).json({
        success: false,
        message: "Recipient not found or inactive."
      });
    }

    let validClaimId = null;

    if (ownerId === userId) {
      // Owner can message only eligible claimants.
      const [claims] = await db.query(
        `SELECT claim_id
         FROM claims
         WHERE item_id = ?
           AND claimant_id = ?
           AND status IN ('pending', 'approved')`,
        [itemId, recipientId]
      );

      if (!claims.length) {
        return res.status(403).json({
          success: false,
          message: "You can message only an eligible claimant."
        });
      }

      validClaimId = claims[0].claim_id;

    } else if (recipientId === ownerId) {
      // Student can message the item owner without a claim.
      const [claims] = await db.query(
        `SELECT claim_id
         FROM claims
         WHERE item_id = ?
           AND claimant_id = ?
           AND status IN ('pending', 'approved')
         LIMIT 1`,
        [itemId, userId]
      );

      // Attach a claim ID if one exists; otherwise leave it null.
      if (claims.length) {
        validClaimId = claims[0].claim_id;
      }

    } else {
      return res.status(403).json({
        success: false,
        message: "You can message only the item owner or an eligible claimant."
      });
    }

    if (
      claim_id &&
      validClaimId !== null &&
      Number(claim_id) !== Number(validClaimId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid claim for this conversation."
      });
    }

    const [result] = await db.query(
      `INSERT INTO messages
       (item_id, claim_id, sender_id, recipient_id, message_text)
       VALUES (?, ?, ?, ?, ?)`,
      [
        itemId,
        validClaimId,
        userId,
        recipientId,
        message_text.trim()
      ]
    );

    await db.query(
      `INSERT INTO notifications
       (user_id, title, message, notification_type, related_item_id)
       VALUES (?, ?, ?, 'message', ?)`,
      [
        recipientId,
        "New message",
        `You received a message about ${items[0].item_name}.`,
        itemId
      ]
    );

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: {
        message_id: result.insertId
      }
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;