import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import dotenv from "dotenv";
import path from "path";

type GlobalWithPool = typeof globalThis & {
  __galleryPool?: DbPool;
};

type SqlitePool = {
  __kind: "sqlite";
  execute: (sql: string, params?: unknown[]) => Promise<[unknown]>;
  query: (sql: string, params?: unknown[]) => Promise<[unknown]>;
};

type DbPool = mysql.Pool | SqlitePool;

function getDbDriver() {
  return (process.env.DB_DRIVER || "mysql").toLowerCase();
}

function getRepoRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === "web" ? path.join(cwd, "..") : cwd;
}

function resolveSqlitePath() {
  const repoRoot = getRepoRoot();
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

function createSqlitePool(): SqlitePool {
  const sqlitePath = resolveSqlitePath();
  const db = new Database(sqlitePath);

  const execute = async (sql: string, params: unknown[] = []): Promise<[unknown]> => {
    if (/^\s*select/i.test(sql)) {
      const rows = db.prepare(sql).all(...(params as any[]));
      return [rows];
    }
    const result = db.prepare(sql).run(...(params as any[]));
    return [{ affectedRows: result.changes ?? 0, insertId: Number(result.lastInsertRowid ?? 0) }];
  };

  return {
    __kind: "sqlite",
    execute,
    query: execute,
  };
}

export function getPool() {
  dotenv.config({ path: path.join(getRepoRoot(), ".env") });
  dotenv.config();

  const globalWithPool = globalThis as GlobalWithPool;
  if (!globalWithPool.__galleryPool) {
    if (getDbDriver() === "sqlite") {
      globalWithPool.__galleryPool = createSqlitePool();
    } else {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error("DATABASE_URL is required");
      }
      const ssl = buildSslConfig(databaseUrl);
      const options: mysql.PoolOptions = { uri: databaseUrl };
      if (ssl) {
        options.ssl = ssl;
      }
      globalWithPool.__galleryPool = mysql.createPool(options);
    }
  }

  return globalWithPool.__galleryPool;
}

export function isSqliteDriver() {
  return getDbDriver() === "sqlite";
}
