import path from "path";
import dotenv from "dotenv";
import { execFile } from "child_process";
import { promisify } from "util";
import { pool } from "./db";

const repoRoot = path.join(__dirname, "..", "..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

type DbClient = {
  execute: (sql: string, params?: unknown[]) => Promise<[unknown, unknown?]>;
};

type PendingCollection = {
  collection_address: string;
  name: string;
  symbol: string;
  verification_attempts: number;
};

const isSqlite = (process.env.DB_DRIVER || "mysql").toLowerCase() === "sqlite";
const POLL_MS = Number(process.env.VERIFIER_POLL_MS || 60000);
const MAX_ATTEMPTS = Number(process.env.VERIFIER_MAX_ATTEMPTS || 5);
const execFileAsync = promisify(execFile);

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function nextPendingCollection(db: DbClient) {
  const [rows] = await db.execute(
    `SELECT collection_address, name, symbol, verification_attempts
     FROM indexed_collections
     WHERE verification_status IN ('pending', 'failed')
       AND verification_attempts < ?
     ORDER BY created_at ASC
     LIMIT 1`,
    [MAX_ATTEMPTS]
  );
  return (rows as PendingCollection[])[0] || null;
}

async function markAttempt(db: DbClient, collection: PendingCollection) {
  await db.execute(
    `UPDATE indexed_collections
     SET verification_status = 'pending',
         verification_provider = 'etherscan',
         verification_attempts = verification_attempts + 1,
         last_verification_attempt_at = ?,
         verification_error = NULL
     WHERE collection_address = ?`,
    [Math.floor(Date.now() / 1000), collection.collection_address]
  );
}

async function markVerified(db: DbClient, collectionAddress: string) {
  await db.execute(
    `UPDATE indexed_collections
     SET verification_status = 'verified',
         verification_provider = 'etherscan',
         verified_at = ?,
         verification_error = NULL
     WHERE collection_address = ?`,
    [Math.floor(Date.now() / 1000), collectionAddress]
  );
}

async function markFailed(db: DbClient, collectionAddress: string, error: string) {
  await db.execute(
    `UPDATE indexed_collections
     SET verification_status = 'failed',
         verification_provider = 'etherscan',
         verification_error = ?
     WHERE collection_address = ?`,
    [error.slice(0, 2000), collectionAddress]
  );
}

async function submitEtherscanVerification(collection: PendingCollection) {
  requireEnv("ETHERSCAN_API_KEY");
  if (collection.name === "Imported GalleryNFT" && collection.symbol === "GALLERY") {
    throw new Error(
      "Collection has placeholder constructor args. Refresh/index the factory event or update indexed_collections name/symbol before verification."
    );
  }
  const protocolDir =
    process.env.VERIFIER_PROTOCOL_DIR || path.resolve(repoRoot, "..", "gallerynft-protocol");
  const network =
    process.env.VERIFIER_NETWORK ||
    (process.env.NEXT_PUBLIC_GALLERYNFT_CHAIN_ID === "1" ? "mainnet" : "sepolia");
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : "npx";
  const args = npmCli
    ? [
        npmCli,
        "exec",
        "--",
        "hardhat",
        "verify",
        "etherscan",
        "--network",
        network,
        "--contract",
        "contracts/GalleryNFT.sol:GalleryNFT",
        collection.collection_address,
        collection.name,
        collection.symbol,
      ]
    : [
        "hardhat",
        "verify",
        "etherscan",
        "--network",
        network,
        "--contract",
        "contracts/GalleryNFT.sol:GalleryNFT",
        collection.collection_address,
        collection.name,
        collection.symbol,
      ];

  try {
    await execFileAsync(
      command,
      args,
      {
        cwd: protocolDir,
        env: {
          ...process.env,
          ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || "",
        },
        timeout: Number(process.env.VERIFIER_TIMEOUT_MS || 180000),
      }
    );
  } catch (err: any) {
    const output = `${err.stdout || ""}\n${err.stderr || ""}\n${err.message || ""}`;
    if (output.toLowerCase().includes("already verified")) return;
    throw new Error(output.trim() || "Hardhat verification failed");
  }
}

async function tick() {
  const collection = await nextPendingCollection(pool);
  if (!collection) return;

  console.log(`Verifying ${collection.collection_address} (${collection.name}/${collection.symbol})`);
  await markAttempt(pool, collection);

  try {
    await submitEtherscanVerification(collection);
    await markVerified(pool, collection.collection_address);
    console.log(`Verified ${collection.collection_address}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    await markFailed(pool, collection.collection_address, message);
    console.error(`Verification failed for ${collection.collection_address}: ${message}`);
  }
}

async function main() {
  if (!isSqlite && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for MySQL verifier mode");
  }

  console.log("Starting verifier worker");
  while (true) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
