const { pool } = require("../config/db");

async function dropTables() {
  try {
    console.log("Dropping tables: scores, gate_scores, notifications, audit_logs...");
    await pool.query(`
      DROP TABLE IF EXISTS scores CASCADE;
      DROP TABLE IF EXISTS gate_scores CASCADE;
      DROP TABLE IF EXISTS notifications CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
    `);
    console.log("SUCCESS: Tables dropped cleanly from PostgreSQL database.");
    process.exit(0);
  } catch (err) {
    console.error("Error dropping tables:", err.message);
    process.exit(1);
  }
}

dropTables();
