const { pool } = require("../config/db");

async function runDiagnostic() {
  try {
    console.log("=== STEP 1: HIERARCHY NODES ===");
    const nodesRes = await pool.query(
      `SELECT id, name, type, parent_id, access_type, is_premium, display_order FROM hierarchy_nodes ORDER BY created_at ASC`
    );
    console.log(`Total hierarchy nodes: ${nodesRes.rows.length}`);
    console.table(nodesRes.rows);

    console.log("\n=== STEP 2: MODULES ===");
    const modsRes = await pool.query(
      `SELECT id, title, module_type, parent_id, access_mode, access_type, is_premium FROM modules ORDER BY created_at ASC`
    );
    console.log(`Total modules: ${modsRes.rows.length}`);
    console.table(modsRes.rows);

    process.exit(0);
  } catch (err) {
    console.error("Diagnostic error:", err);
    process.exit(1);
  }
}

runDiagnostic();
