const { pool } = require("../config/db");

async function runDiagnostic() {
  try {
    console.log("=== 1. SEARCH HIERARCHY NODES FOR ELECTRICAL / BASIC CONCEPTS ===");
    const nodes = await pool.query(
      `SELECT id, name, type, parent_id, access_type, is_premium, display_order FROM hierarchy_nodes WHERE name ILIKE '%ELECTRICAL%' OR name ILIKE '%BASIC CONCEPTS%'`
    );
    console.table(nodes.rows);

    if (nodes.rows.length > 0) {
      const ids = nodes.rows.map(r => r.id);
      console.log("\n=== 2. SEARCH CHILDREN OF THESE NODES ===");
      const children = await pool.query(
        `SELECT id, name, type, parent_id FROM hierarchy_nodes WHERE parent_id = ANY($1::varchar[])`,
        [ids]
      );
      console.table(children.rows);

      console.log("\n=== 3. SEARCH MODULES ATTACHED TO THESE NODES ===");
      const modules = await pool.query(
        `SELECT id, title, module_type, parent_id, access_mode, access_type, is_premium FROM modules WHERE parent_id = ANY($1::varchar[])`,
        [ids]
      );
      console.table(modules.rows);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runDiagnostic();
