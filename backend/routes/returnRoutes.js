
const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware");

const router = express.Router();

router.use(authRequired);

// Get return records for the logged-in user
router.get("/", async (req, res, next) => {
  try {
    let sql = `
      SELECT
        rr.*,
        i.item_name,
        c.status AS claim_status,
        owner.full_name AS owner_name,
        finder.full_name AS finder_name
      FROM return_records rr
      JOIN items i ON i.item_id = rr.item_id
      LEFT JOIN claims c ON c.claim_id = rr.claim_id
      JOIN users owner ON owner.user_id = rr.owner_id
      JOIN users finder ON finder.user_id = rr.finder_id
    `;

    const params = [];

    if (req.user.role !== "admin") {
      sql += " WHERE rr.owner_id = ? OR rr.finder_id = ?";
      params.push(req.user.user_id, req.user.user_id);
    }

    sql += " ORDER BY rr.returned_at DESC";

    const [data] = await db.query(sql, params);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Confirm item handover
router.post("/:claimId/confirm", async (req, res, next) => {
  let connection;

  try {
    connection = await db.getConnection();

    const claimId = Number(req.params.claimId);
    const userId = Number(req.user.user_id);
    const notes = String(req.body?.notes || "").trim();

    if (!Number.isInteger(claimId) || claimId < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid claim ID."
      });
    }

    await connection.beginTransaction();

    // Get claim and item owner
    const [claims] = await connection.query(
      `SELECT
         c.claim_id,
         c.item_id,
         c.claimant_id,
         c.status,
         i.user_id AS owner_id
       FROM claims c
       JOIN items i ON i.item_id = c.item_id
       WHERE c.claim_id = ?
       FOR UPDATE`,
      [claimId]
    );

    if (!claims.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Claim not found."
      });
    }

    const claim = claims[0];
    const ownerId = Number(claim.owner_id);
    const finderId = Number(claim.claimant_id);

    if (!["approved", "completed"].includes(claim.status)) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Only approved claims can be returned."
      });
    }

    // Only owner and claimant can confirm
    if (userId !== ownerId && userId !== finderId) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "Only the item owner and claimant can confirm the return."
      });
    }

    // Check existing return record
    const [existing] = await connection.query(
      "SELECT * FROM return_records WHERE item_id = ? FOR UPDATE",
      [claim.item_id]
    );

    if (
      existing.length &&
      Number(existing[0].claim_id) !== claimId
    ) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "A different claim already has a return record for this item."
      });
    }

    // Prevent duplicate confirmation after completion
    if (
      existing.length &&
      Number(existing[0].owner_confirmed) === 1 &&
      Number(existing[0].finder_confirmed) === 1
    ) {
      await connection.rollback();

      return res.json({
        success: true,
        message: "This item has already been returned."
      });
    }

    // Create a new return record
    if (!existing.length) {
      // Generate unique return ID
      const [counters] = await connection.query(
        "SELECT next_id FROM return_id_sequence WHERE id = 1 FOR UPDATE"
      );

      if (!counters.length) {
        throw new Error("Return ID counter is not initialized.");
      }

      const returnId = Number(counters[0].next_id);

      await connection.query(
        "UPDATE return_id_sequence SET next_id = next_id + 1 WHERE id = 1"
      );

      await connection.query(
        `INSERT INTO return_records
         (return_id, item_id, claim_id, owner_id, finder_id,
          owner_confirmed, finder_confirmed, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          claim.item_id,
          claimId,
          ownerId,
          finderId,
          userId === ownerId ? 1 : 0,
          userId === finderId ? 1 : 0,
          notes || null
        ]
      );
    } else {
      // Update the confirmation of the current user
      const column =
        userId === ownerId ? "owner_confirmed" : "finder_confirmed";

      await connection.query(
        `UPDATE return_records
         SET ${column} = 1,
             notes = CASE WHEN ? <> '' THEN ? ELSE notes END
         WHERE item_id = ?`,
        [notes, notes, claim.item_id]
      );
    }

    // Get updated return record
    const [records] = await connection.query(
      "SELECT * FROM return_records WHERE item_id = ?",
      [claim.item_id]
    );

    const record = records[0];

    const bothConfirmed =
      Number(record.owner_confirmed) === 1 &&
      Number(record.finder_confirmed) === 1;

    // Complete return when both parties confirm
    if (bothConfirmed) {
      await connection.query(
        "UPDATE items SET status = 'returned' WHERE item_id = ?",
        [claim.item_id]
      );

      await connection.query(
        "UPDATE claims SET status = 'completed' WHERE claim_id = ?",
        [claimId]
      );
    }

    // Identify the other user
    const otherUserId =
      userId === ownerId ? finderId : ownerId;

    // Generate unique notification ID
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

    // Insert notification
    await connection.query(
      `INSERT INTO notifications
       (notification_id, user_id, title, message,
        notification_type, related_item_id)
       VALUES (?, ?, ?, ?, 'return', ?)`,
      [
        notificationId,
        otherUserId,
        "Return confirmation",
        bothConfirmed
          ? "Both parties confirmed the item return."
          : "The other party has confirmed the item handover. Please confirm it too.",
        claim.item_id
      ]
    );

    await connection.commit();

    res.json({
      success: true,
      message: bothConfirmed
        ? "Both parties confirmed. Item successfully marked as returned."
        : "Your confirmation was saved. Waiting for the other party.",
      data: {
        return_id: record.return_id,
        owner_confirmed: Number(record.owner_confirmed),
        finder_confirmed: Number(record.finder_confirmed),
        completed: bothConfirmed
      }
    });

  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Transaction rollback failed:", rollbackError);
      }
    }

    next(err);

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
