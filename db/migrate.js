const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { pool } = require("./index");

async function run() {
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
  dotenv.config();
  const driver = (process.env.DB_DRIVER || "mysql").toLowerCase();
  const migrationsDir =
    driver === "sqlite"
      ? path.join(__dirname, "..", "migrations", "sqlite")
      : path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         filename VARCHAR(255) PRIMARY KEY,
         applied_at BIGINT NOT NULL
       )`
    );

    const [appliedRows] = await connection.query(
      `SELECT filename FROM schema_migrations`
    );
    const applied = new Set(
      (appliedRows || []).map((row) => row.filename)
    );

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8");
      const statements = sql
        .split(/;\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (err) {
          if (
            err &&
            (err.code === "ER_DUP_FIELDNAME" ||
              err.code === "ER_DUP_KEYNAME" ||
              err.code === "ER_CANT_DROP_FIELD_OR_KEY" ||
              err.code === "ER_BAD_FIELD_ERROR")
          ) {
            continue;
          }
          throw err;
        }
      }

      await connection.query(
        `INSERT INTO schema_migrations (filename, applied_at)
         VALUES (?, ?)`,
        [file, Math.floor(Date.now() / 1000)]
      );
      console.log(`Applied ${file}`);
    }
  } finally {
    connection.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
