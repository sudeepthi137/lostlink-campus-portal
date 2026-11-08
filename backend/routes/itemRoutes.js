
const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const db = require("../db");

const { authRequired, adminRequired } = require("../middleware");
const router = express.Router();

// Connect to Supabase Storage
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bucket = process.env.SUPABASE_BUCKET || "item-images";

// Store uploaded images in memory before sending them to Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_q, f, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(f.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG and WEBP images are allowed."));
    }
  }
});

// Upload image to Supabase Storage
async function uploadImage(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  const filename = `${Date.now()}-${crypto.randomUUID()}${extension}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error("Image upload failed: " + error.message);
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return data.publicUrl;
}

// GET ALL ITEMS
router.get("/", async (req, res, next) => {
  try {
    let sql =
      "SELECT i.item_id,i.user_id,i.category_id,i.item_name,i.description,i.item_type,i.location,i.item_date,i.image_path,i.status,i.created_at,c.category_name FROM items i LEFT JOIN categories c ON c.category_id=i.category_id WHERE 1=1";

    const a = [];
    const {
      search = "",
      type = "",
      category_id = "",
      location = ""
    } = req.query;

    if (search) {
      sql += " AND (i.item_name LIKE ? OR i.description LIKE ?)";
      a.push("%" + search + "%", "%" + search + "%");
    }

    if (["lost", "found"].includes(type)) {
      sql += " AND i.item_type=?";
      a.push(type);
    }

    if (category_id) {
      sql += " AND i.category_id=?";
      a.push(category_id);
    }

    if (location) {
      sql += " AND i.location LIKE ?";
      a.push("%" + location + "%");
    }

    sql += " ORDER BY i.created_at DESC";

    const [data] = await db.query(sql, a);

    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

// GET ITEM BY ID
router.get("/:id", async (req, res, next) => {
  try {
    const [r] = await db.query(
      "SELECT i.*,c.category_name FROM items i LEFT JOIN categories c ON c.category_id=i.category_id WHERE i.item_id=?",
      [req.params.id]
    );

    if (!r.length) {
      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    res.json({ success: true, data: r[0] });
  } catch (e) {
    next(e);
  }
});

// REPORT A NEW ITEM
router.post("/", authRequired, upload.single("image"), async (req, res, next) => {
  try {
    const {
      category_id,
      item_name,
      description,
      item_type,
      location,
      item_date
    } = req.body;

    if (
      !item_name?.trim() ||
      !description?.trim() ||
      !["lost", "found"].includes(item_type) ||
      !location?.trim() ||
      !item_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Item name, description, valid type, location and date are required."
      });
    }

    // Upload image to Supabase and save its public URL
    const image = req.file ? await uploadImage(req.file) : null;

    // Generate the next item ID
    const [[{ nextId }]] = await db.query(
      "SELECT COALESCE(MAX(item_id), 0) + 1 AS nextId FROM items"
    );

    await db.query(
      "INSERT INTO items (item_id,user_id,category_id,item_name,description,item_type,location,item_date,image_path,status) VALUES (?,?,?,?,?,?,?,?,?,'open')",
      [
        nextId,
        req.user.user_id,
        category_id || null,
        item_name.trim(),
        description.trim(),
        item_type,
        location.trim(),
        item_date,
        image
      ]
    );

    const [data] = await db.query(
      "SELECT i.*,c.category_name FROM items i LEFT JOIN categories c ON c.category_id=i.category_id WHERE i.item_id=?",
      [nextId]
    );

    res.status(201).json({
      success: true,
      message: "Item reported.",
      data: data[0]
    });
  } catch (e) {
    next(e);
  }
});

// UPDATE ITEM STATUS
router.patch("/:id/status", authRequired, async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!["open", "claimed", "returned", "closed", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status."
      });
    }

    const [r] = await db.query(
      "SELECT user_id FROM items WHERE item_id=?",
      [req.params.id]
    );

    if (!r.length) {
      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    if (
      r[0].user_id !== req.user.user_id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not allowed."
      });
    }

    await db.query(
      "UPDATE items SET status=? WHERE item_id=?",
      [status, req.params.id]
    );

    res.json({
      success: true,
      message: "Status updated."
    });
  } catch (e) {
    next(e);
  }
});

// DELETE ITEM (ADMIN ONLY)
router.delete("/:id", authRequired, adminRequired, async (req, res, next) => {
  try {
    const [r] = await db.query(
      "DELETE FROM items WHERE item_id=?",
      [req.params.id]
    );

    if (!r.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "Item not found."
      });
    }

    res.json({
      success: true,
      message: "Item deleted."
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
