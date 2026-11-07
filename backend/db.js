const mysql = require("mysql2/promise");
const fs = require("fs");
require("dotenv").config();

const isCloud = process.env.DB_HOST &&
  process.env.DB_HOST !== "localhost";

const poolConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "lost_found_portal",
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
};

if (isCloud) {
  poolConfig.ssl = {
    ca: fs.readFileSync(
      process.env.DB_CA_PATH || "./isrgrootx1.pem",
      "utf8"
    ),
    rejectUnauthorized: true,
  };
}

module.exports = mysql.createPool(poolConfig);