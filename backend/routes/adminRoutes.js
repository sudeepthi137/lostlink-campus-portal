
const express = require("express");
const db = require("../db");
const { authRequired, adminRequired } = require("../middleware");

const router = express.Router();

// Protect every admin endpoint.
router.use(authRequired, adminRequired);

// Dashboard summary
router.get("/summary", async (_req, res, next) => {
  try {
    const [[users]] = await db.query(
      "SELECT COUNT(*) AS count FROM users"
    );
    const [[items]] = await db.query(
      "SELECT COUNT(*) AS count FROM items"
    );
    const [[claims]] = await db.query(
      "SELECT COUNT(*) AS count FROM claims"
    );
    const [[pendingClaims]] = await db.query(
      "SELECT COUNT(*) AS count FROM claims WHERE LOWER(status) = 'pending'"
    );
    const [[reports]] = await db.query(
      "SELECT COUNT(*) AS count FROM reports"
    );
    const [[pendingReports]] = await db.query(
      "SELECT COUNT(*) AS count FROM reports WHERE LOWER(status) = 'pending'"
    );

    res.json({
      success: true,
      data: {
        users: users.count,
        items: items.count,
        claims: claims.count,
        pending_claims: pendingClaims.count,
        reports: reports.count,
        pending_reports: pendingReports.count
      }
    });
  } catch (error) {
    next(error);
  }
});

// List users
router.get("/users", async (_req, res, next) => {
  try {
    const [data] = await db.query(
      `SELECT user_id, full_name, email, role, department,
              is_active, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Activate or deactivate a user
router.patch("/users/:id/active", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const active = req.body.active;

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID."
      });
    }

    if (typeof active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "active must be true or false."
      });
    }

    if (userId === Number(req.user.user_id) && !active) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate yourself."
      });
    }

    const [result] = await db.query(
      "UPDATE users SET is_active = ? WHERE user_id = ?",
      [active ? 1 : 0, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    res.json({ success: true, message: "User updated." });
  } catch (error) {
    next(error);
  }
});

// View all claims
router.get("/claims", async (_req, res, next) => {
  try {
    const [data] = await db.query(
      `SELECT c.*, i.item_name,
              u.full_name AS claimant_name,
              u.email AS claimant_email
       FROM claims c
       LEFT JOIN items i ON i.item_id = c.item_id
       LEFT JOIN users u ON u.user_id = c.claimant_id
       ORDER BY c.created_at DESC`
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Review a claim
router.patch("/claims/:id/review", async (req, res, next) => {
  try {
    const claimId = Number(req.params.id);
    const { status, review_note } = req.body;
    const allowed = ["pending", "approved", "rejected"];

    if (!Number.isInteger(claimId) || claimId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid claim ID."
      });
    }

    if (!allowed.includes(String(status).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Status must be pending, approved, or rejected."
      });
    }

    const [result] = await db.query(
      `UPDATE claims
       SET status = ?, reviewed_by = ?, review_note = ?,
           reviewed_at = NOW()
       WHERE claim_id = ?`,
      [
        String(status).toLowerCase(),
        req.user.user_id,
        review_note || null,
        claimId
      ]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Claim not found."
      });
    }

    res.json({ success: true, message: "Claim reviewed." });
  } catch (error) {
    next(error);
  }
});

// View all reports
router.get("/reports", async (_req, res, next) => {
  try {
    const [data] = await db.query(
      `SELECT r.*, i.item_name,
              u.full_name AS reporter_name,
              u.email AS reporter_email
       FROM reports r
       LEFT JOIN items i ON i.item_id = r.item_id
       LEFT JOIN users u ON u.user_id = r.reported_by
       ORDER BY r.created_at DESC`
    );

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Review a report
router.patch("/reports/:id/review", async (req, res, next) => {
  try {
    const reportId = Number(req.params.id);
    const { status } = req.body;
    const allowed = ["pending", "reviewed", "resolved", "rejected"];

    if (!Number.isInteger(reportId) || reportId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid report ID."
      });
    }

    if (!allowed.includes(String(status).toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid report status."
      });
    }

    const [result] = await db.query(
      `UPDATE reports
       SET status = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE report_id = ?`,
      [String(status).toLowerCase(), req.user.user_id, reportId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Report not found."
      });
    }

    res.json({ success: true, message: "Report reviewed." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
