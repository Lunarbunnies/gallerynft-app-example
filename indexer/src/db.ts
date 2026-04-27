import path from "path";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import Database from "better-sqlite3";

const repoRoot = path.join(__dirname, "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

function resolveSqlitePath() {
  const configured = process.env.SQLITE_PATH;
  if (!configured) {
    return path.join(repoRoot, "dev.sqlite");
  }
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(repoRoot, configured);
}

function buildSslConfig(databaseUrl: string) {
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

  return { rejectUnauthorized: false } as const;
}

function createPoolFromEnv() {
  const driver = (process.env.DB_DRIVER || "mysql").toLowerCase();
  if (driver === "sqlite") {
    const sqlitePath = resolveSqlitePath();
    const db = new Database(sqlitePath);
    const execute = async (sql: string, params: unknown[] = []) => {
      if (/^\s*select/i.test(sql)) {
        const rows = db.prepare(sql).all(...(params as any[]));
        return [rows] as [unknown];
      }
      const result = db.prepare(sql).run(...(params as any[]));
      return [
        {
          affectedRows: result.changes ?? 0,
          insertId: Number(result.lastInsertRowid ?? 0),
        },
      ] as [unknown];
    };
    return {
      execute,
      query: execute,
      end: async () => {},
    };
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const ssl = buildSslConfig(databaseUrl);
  const options: mysql.PoolOptions = { uri: databaseUrl };
  if (ssl) {
    options.ssl = ssl;
  }

  return mysql.createPool(options);
}

export const pool = createPoolFromEnv();
