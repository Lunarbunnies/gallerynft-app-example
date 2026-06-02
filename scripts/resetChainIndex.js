const { pool } = require("../db");

async function safeDelete(tableName) {
  try {
    await pool.query(`DELETE FROM ${tableName}`);
    console.log(`Cleared ${tableName}`);
  } catch (err) {
    if (err && err.code === "ER_NO_SUCH_TABLE") return;
    if (err && err.code === "SQLITE_ERROR" && String(err.message || "").includes("no such table")) return;
    throw err;
  }
}

async function run() {
  await safeDelete("indexed_item_metadata");
  await safeDelete("indexed_gallery_items");
  await safeDelete("indexed_galleries");
  await safeDelete("indexed_collections");
  await pool.query(`DELETE FROM indexer_checkpoints WHERE source_name = ?`, ["chain"]);
  console.log("Cleared chain index checkpoint");
  await pool.end();
}

run().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
