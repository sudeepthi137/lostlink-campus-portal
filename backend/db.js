const mysql = require("mysql2/promise");
require("dotenv").config();
module.exports = mysql.createPool({
 host: process.env.DB_HOST || "localhost",
 user: process.env.DB_USER || "root",
 password: process.env.DB_PASSWORD || "",
 database: process.env.DB_NAME || "lost_found_portal",
 waitForConnections: true, connectionLimit: 10, dateStrings: true
});
