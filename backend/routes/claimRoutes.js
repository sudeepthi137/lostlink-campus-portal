
const express = require("express");
const db = require("../db");
const {
  authRequired,
  adminRequired
} = require("../middleware");

const router = express.Router();

// GET ALL CLAIMS
router.get("/", authRequired, async (req, res, next) => {
  try {
    let sql = `
      SELECT
        cl.claim_id,
        cl.item_id,
        cl.claimant_id,
        cl.proof_details,
        cl.status,
        cl.created_at,
        i.item_name,
        i.item_type,
        i.user_id AS owner_id,
        u.full_name AS claimant_name
      FROM claims cl
      JOIN items i ON i.item_id = cl.item_id
      JOIN users u ON u.user_id = cl.claimant_id
    `;

    let params = [];

    if (req.user.role !== "admin") {
      sql += " WHERE cl.claimant_id = ? OR i.user_id = ?";
      params = [req.user.user_id, req.user.user_id];
    }

    sql += " ORDER BY cl.created_at DESC";

    const [data] = await db.query(sql, params);

    res.json({
      success: true,
      data
    });

  } catch (e) {
    next(e);
  }
});

// SUBMIT A CLAIM
router.post("/", authRequired, async (req, res, next) => {
  let connection;
  let transactionStarted = false;

  try {
    const { item_id, proof_details } = req.body || {};

    if (!item_id || !proof_details?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Item ID and proof details are required."
      });
    }

    connection = await db.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    const [items] = await connection.query(
      "SELECT item_id, user_id, status FROM items WHERE item_id = ?",
      [item_id]
    );

    if (!items.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    if (Number(items[0].user_id) === Number(req.user.user_id)) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(400).json({
        success: false,
        message: "You cannot claim your own item."
      });
    }

    if (items[0].status !== "open") {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "Item is not open for claims."
      });
    }

    const [dup] = await connection.query(
      `SELECT claim_id
       FROM claims
       WHERE item_id = ?
       AND claimant_id = ?
       AND status IN ('pending', 'approved')`,
      [item_id, req.user.user_id]
    );

    if (dup.length) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "You already have an active claim."
      });
    }

    // Generate the next available claim ID.
    const [idRows] = await connection.query(
      "SELECT COALESCE(MAX(claim_id), 0) + 1 AS next_id FROM claims"
    );

    const newClaimId = Number(idRows[0].next_id);

    await connection.query(
      `INSERT INTO claims
       (claim_id, item_id, claimant_id, proof_details, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [
        newClaimId,
        item_id,
        req.user.user_id,
        proof_details.trim()
      ]
    );

    await connection.commit();
    transactionStarted = false;

    res.status(201).json({
      success: true,
      message: "Claim submitted.",
      data: {
        claim_id: newClaimId,
        item_id: Number(item_id),
        status: "pending"
      }
    });

  } catch (e) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }

    next(e);

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// ADMIN: UPDATE CLAIM STATUS
router.patch("/:id/status", authRequired, adminRequired, async (req, res, next) => {
  try {
    const { status } = req.body || {};

    if (!["pending", "approved", "rejected", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid claim status."
      });
    }

    const [r] = await db.query(
      "UPDATE claims SET status = ? WHERE claim_id = ?",
      [status, req.params.id]
    );

    if (!r.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Claim not found."
      });
    }

    if (status === "approved") {
      const [c] = await db.query(
        "SELECT item_id FROM claims WHERE claim_id = ?",
        [req.params.id]
      );

      if (c.length) {
        await db.query(
          "UPDATE items SET status = 'claimed' WHERE item_id = ?",
          [c[0].item_id]
        );
      }
    }

    res.json({
      success: true,
      message: "Claim status updated."
    });

  } catch (e) {
    next(e);
  }
});

module.exports = router;
