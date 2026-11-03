
const express = require("express");
const router = express.Router();

const db = require("../db");
const { authRequired } = require("../middleware");

// Submit a report for admin review
router.post("/", authRequired, async (req, res) => {
  try {
    const { item_id, reason, details } = req.body;

    const reportedBy = req.user.user_id || req.user.id;

    if (!reportedBy) {
      return res.status(401).json({
        success: false,
        message: "Please log in again.",
      });
    }

    if (!item_id || !reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Item and reason are required.",
      });
    }

    // Verify that the item exists
    const [items] = await db.query(
      "SELECT item_id FROM items WHERE item_id = ?",
      [item_id]
    );

    if (items.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Item not found.",
      });
    }

    // Insert into the existing reports table
    const [result] = await db.query(
      `INSERT INTO reports
       (item_id, reported_by, reason, details, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        item_id,
        reportedBy,
        reason.trim(),
        (details || "").trim(),
        "pending",
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Report saved successfully.",
      data: {
        report_id: result.insertId,
        item_id: Number(item_id),
        reported_by: reportedBy,
        reason: reason.trim(),
        details: (details || "").trim(),
        status: "pending",
      },
    });
  } catch (error) {
    console.error("Report submission error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to save report to the database.",
    });
  }
});

module.exports = router;
