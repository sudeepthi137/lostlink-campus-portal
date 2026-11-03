
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 5000);

// Create uploads directory if it doesn't exist
const uploads = path.join(__dirname, "uploads");
fs.mkdirSync(uploads, { recursive: true });

// Allow the Vite frontend ports
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "https://lostlink-campus-portal.netlify.app",
    ],
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(uploads));

// API home
app.get("/", (_req, res) => {
  res.send("LostLink API is running.");
});

// Database health check
app.get("/api/health", async (_req, res) => {
  try {
    await require("./db").query("SELECT 1");

    res.json({
      success: true,
      message: "LostLink backend and database are working.",
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(500).json({
      success: false,
      message: "Database connection failed.",
      detail: error.message,
    });
  }
});

// Existing API routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/items", require("./routes/itemRoutes"));
app.use("/api/claims", require("./routes/claimRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));

// New Messages and Notifications routes
app.use("/api/messages", require("./routes/messageRoutes.js"));
app.use("/api/notifications", require("./routes/notificationRoutes.js"));

const returnRoutes = require("./routes/returnRoutes.js");

console.log(
  "Loaded return routes:",
  returnRoutes.stack.map((r) => r.route?.path).filter(Boolean)
);

app.use("/api/returns", returnRoutes);

// Handle errors
app.use((err, _req, res, _next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server error.",
  });
});

// Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`LostLink API running on port ${PORT}`);
});
