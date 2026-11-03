
const db = require("./db");

async function testConnection() {
  try {
    const connection = await db.getConnection();

    console.log("Success! Node.js connected to MySQL.");

    const [rows] = await connection.query(
      "SELECT DATABASE() AS databaseName"
    );

    console.log("Connected database:", rows[0].databaseName);

    connection.release();
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error("Database connection failed:", error.message);
    await db.end();
    process.exit(1);
  }
}

testConnection();
