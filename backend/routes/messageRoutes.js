
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
  let connection;

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
      typeof message_text !== "string" ||
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
      const [claims] = await db.query(
        `SELECT claim_id
         FROM claims
         WHERE item_id = ?
           AND claimant_id = ?
           AND status IN ('pending', 'approved')
         LIMIT 1`,
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
      const [claims] = await db.query(
        `SELECT claim_id
         FROM claims
         WHERE item_id = ?
           AND claimant_id = ?
           AND status IN ('pending', 'approved')
         LIMIT 1`,
        [itemId, userId]
      );

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

    // Use a transaction to generate a unique message ID
    // and save the message and notification together.
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [counters] = await connection.query(
      "SELECT next_id FROM message_id_sequence WHERE id = 1 FOR UPDATE"
    );

    if (!counters.length) {
      throw new Error("Message ID counter is not initialized.");
    }

    const messageId = Number(counters[0].next_id);

    await connection.query(
      "UPDATE message_id_sequence SET next_id = next_id + 1 WHERE id = 1"
    );

    await connection.query(
      `INSERT INTO messages
       (message_id, item_id, claim_id, sender_id, recipient_id, message_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        messageId,
        itemId,
        validClaimId,
        userId,
        recipientId,
        message_text.trim()
      ]
    );

    const [notificationCounters] = await connection.query(
      "SELECT next_id FROM notification_id_sequence WHERE id = 1 FOR UPDATE"
    );

    if (!notificationCounters.length) {
      throw new Error("Notification ID counter is not initialized.");
    }

    const notificationId = Number(notificationCounters[0].next_id);

    await connection.query(
      "UPDATE notification_id_sequence SET next_id = next_id + 1 WHERE id = 1"
    );

    await connection.query(
      `INSERT INTO notifications
       (notification_id, user_id, title, message, notification_type, related_item_id)
       VALUES (?, ?, ?, ?, 'message', ?)`,
      [
        notificationId,
        recipientId,
        "New message",
        `You received a message about ${items[0].item_name}.`,
        itemId
      ]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: {
        message_id: messageId
      }
    });

  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    next(err);
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
