const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const Database = require("better-sqlite3");

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config();

function buildSslConfig(databaseUrl) {
  const mode = (process.env.DB_SSL_MODE || "disabled").toLowerCase();
  if (mode === "disabled") {
    return null;
  }

  if (mode === "preferred") {
    try {
      const url = new URL(databaseUrl);
      const sslMode = url.searchParams.get("ssl-mode");
      if (!sslMode || sslMode.toUpperCase() !== "REQUIRED") {
        return null;
      }
    } catch (_err) {
      return null;
    }
  }

  return { rejectUnauthorized: false };
}

function createPoolFromEnv() {
  const driver = (process.env.DB_DRIVER || "mysql").toLowerCase();
  if (driver === "sqlite") {
    const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, "..", "dev.sqlite");
    const db = new Database(sqlitePath);
    const runQuery = async (sql, params = []) => {
      if (/^\s*select/i.test(sql)) {
        return [db.prepare(sql).all(...params)];
      }
      const result = db.prepare(sql).run(...params);
      return [{ affectedRows: result.changes ?? 0, insertId: Number(result.lastInsertRowid ?? 0) }];
    };
    return {
      execute: runQuery,
      query: runQuery,
      getConnection: async () => ({
        query: runQuery,
        execute: runQuery,
        release: () => {},
      }),
      end: async () => {},
    };
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const ssl = buildSslConfig(databaseUrl);
  const options = { uri: databaseUrl };
  if (ssl) {
    options.ssl = ssl;
  }

  return mysql.createPool(options);
}

const pool = createPoolFromEnv();

module.exports = {
  pool,
  createPoolFromEnv,
};
