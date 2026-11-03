
const express = require("express");
const db = require("../db");
const { authRequired } = require("../middleware");
const router = express.Router();

router.use(authRequired);

// Get notifications for the logged-in user
router.get("/", async (req, res, next) => {
  try {
    const [data] = await db.query(
      `SELECT notification_id, user_id, title, message,
              notification_type, related_item_id, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.user_id]
    );

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Mark one of the user's notifications as read
router.patch("/:id/read", async (req, res, next) => {
  try {
    const [result] = await db.query(
      `UPDATE notifications
       SET is_read = 1
       WHERE notification_id = ? AND user_id = ?`,
      [req.params.id, req.user.user_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    res.json({ success: true, message: "Notification marked as read." });
  } catch (err) {
    next(err);
  }
});

// Mark all of the user's notifications as read
router.patch("/read-all", async (req, res, next) => {
  try {
    await db.query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
      [req.user.user_id]
    );

    res.json({ success: true, message: "All notifications marked as read." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
