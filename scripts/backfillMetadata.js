const path = require("path");
const dotenv = require("dotenv");
const mysql = require("mysql2/promise");
const Database = require("better-sqlite3");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

dotenv.config();

function buildSslConfig(databaseUrl) {
  const mode = (process.env.DB_SSL_MODE || "disabled").toLowerCase();
  if (mode === "disabled") return null;
  if (mode === "preferred") {
    try {
      const url = new URL(databaseUrl);
      const sslMode = url.searchParams.get("ssl-mode");
      if (!sslMode || sslMode.toUpperCase() !== "REQUIRED") return null;
    } catch (_err) {
      return null;
    }
  }
  return { rejectUnauthorized: false };
}

async function createPool() {
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
      end: async () => {},
    };
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const ssl = buildSslConfig(databaseUrl);
  const options = { uri: databaseUrl };
  if (ssl) options.ssl = ssl;
  return mysql.createPool(options);
}

async function main() {
  const pool = await createPool();
  const galleryArg = process.argv.find((arg) => arg.startsWith("--galleryId="));
  const galleryId = galleryArg ? Number(galleryArg.split("=")[1]) : null;
  if (galleryArg && !Number.isFinite(galleryId)) {
    throw new Error("Invalid --galleryId");
  }
  const [rows] = await pool.execute(
    `SELECT gallery_id AS galleryId, item_key AS itemKey, packed_ref AS packedRef
     FROM gallery_items
     WHERE kind = 0 AND removed_at = 0 AND (token_uri IS NULL OR image_url IS NULL)
     ${galleryId ? "AND gallery_id = ?" : ""}`
    , galleryId ? [galleryId] : []
  );

  if (rows.length === 0) {
    console.log("No items to backfill.");
    await pool.end();
    return;
  }

  const { decodePackedRef } = await import("../shared/dist/index.js");

  function getAlchemyRpcUrl(chainId) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      throw new Error("ALCHEMY_API_KEY is not set");
    }
    const map = {
      1: "https://eth-mainnet.g.alchemy.com/v2/",
      137: "https://polygon-mainnet.g.alchemy.com/v2/",
      8453: "https://base-mainnet.g.alchemy.com/v2/",
    };
    const baseUrl = map[chainId];
    if (!baseUrl) {
      throw new Error(`Unsupported chainId ${chainId}`);
    }
    return `${baseUrl}${apiKey}`;
  }

  function pad32(hex) {
    return hex.padStart(64, "0");
  }

  function encodeUint256(value) {
    const v = BigInt(value);
    return pad32(v.toString(16));
  }

  function decodeAbiString(hexData) {
    const normalized = hexData.startsWith("0x") ? hexData.slice(2) : hexData;
    if (normalized.length < 128) {
      throw new Error("Invalid ABI string length");
    }
    const lengthHex = normalized.slice(64, 128);
    const length = Number.parseInt(lengthHex, 16);
    const start = 128;
    const end = start + length * 2;
    const data = normalized.slice(start, end);
    return Buffer.from(data, "hex").toString("utf8");
  }

  async function rpcCall(url, to, data) {
    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    };
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Alchemy RPC failed: ${response.status}`);
    }
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message || "RPC error");
    }
    if (!json.result) {
      throw new Error("Empty RPC result");
    }
    return json.result;
  }

  async function fetchEvmTokenUri(chainId, contractAddress, tokenId) {
    const url = getAlchemyRpcUrl(chainId);
    const tokenIdHex = encodeUint256(tokenId);
    const erc721Selector = "0xc87b56dd";
    const erc1155Selector = "0x0e89341c";
    try {
      const data = `${erc721Selector}${tokenIdHex}`;
      const result = await rpcCall(url, contractAddress, data);
      return decodeAbiString(result);
    } catch (_err) {
      const data = `${erc1155Selector}${tokenIdHex}`;
      const result = await rpcCall(url, contractAddress, data);
      return decodeAbiString(result);
    }
  }

  async function fetchEvmMetadataFallback(chainId, contractAddress, tokenId) {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) throw new Error("ALCHEMY_API_KEY is not set");
    const map = {
      1: "https://eth-mainnet.g.alchemy.com/nft/v2/",
      137: "https://polygon-mainnet.g.alchemy.com/nft/v2/",
      8453: "https://base-mainnet.g.alchemy.com/nft/v2/",
    };
    const baseUrl = map[chainId];
    if (!baseUrl) throw new Error(`Unsupported chainId ${chainId}`);
    const url = `${baseUrl}${apiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}&refreshCache=true`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alchemy NFT API failed: ${response.status}`);
    }
    return await response.json();
  }

  function resolveUri(uri) {
    if (uri.startsWith("ipfs://")) {
      return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
    }
    if (uri.startsWith("ar://")) {
      return `https://arweave.net/${uri.replace("ar://", "")}`;
    }
    return uri;
  }

  function normalizeImageUrl(url) {
    if (!url) return null;
    if (url.startsWith("data:image/svg+xml;utf8,")) {
      const raw = url.replace("data:image/svg+xml;utf8,", "");
      const base64 = Buffer.from(raw, "utf8").toString("base64");
      return `data:image/svg+xml;base64,${base64}`;
    }
    return url;
  }

  function decodeDataUri(uri) {
    const match = uri.match(/^data:application\/json;base64,(.+)$/);
    if (!match) {
      throw new Error("Unsupported data URI");
    }
    const json = Buffer.from(match[1], "base64").toString("utf8");
    return JSON.parse(json);
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Metadata fetch failed: ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchTokenMetadata(tokenUri) {
    let metadata;
    if (tokenUri.startsWith("data:")) {
      metadata = decodeDataUri(tokenUri);
    } else {
      const resolved = resolveUri(tokenUri);
      metadata = await fetchJson(resolved);
    }
    const image = metadata.image_url || metadata.image;
    const imageUrl = image ? resolveUri(image) : null;
    return {
      raw: metadata,
      name: metadata.name || null,
      description: metadata.description || null,
      imageUrl,
    };
  }

  function normalizeMetadata(raw) {
    const image = raw.image_url || raw.image;
    const imageUrl = image ? normalizeImageUrl(resolveUri(image)) : null;
    return {
      raw,
      name: raw.name || null,
      description: raw.description || null,
      imageUrl,
    };
  }

  let processed = 0;
  for (const row of rows) {
    const packedRefHex = `0x${Buffer.from(row.packedRef).toString("hex")}`;
    const decoded = decodePackedRef(packedRefHex);
    if (decoded.kind !== "evm") continue;

    try {
      let tokenUri = null;
      let metadata = null;
      try {
        tokenUri = await fetchEvmTokenUri(
          Number(decoded.chainId),
          decoded.contractAddress,
          decoded.tokenId.toString()
        );
        metadata = await fetchTokenMetadata(tokenUri);
      } catch (_err) {
        const fallback = await fetchEvmMetadataFallback(
          Number(decoded.chainId),
          decoded.contractAddress,
          decoded.tokenId.toString()
        );
        const raw = fallback.metadata || {};
        const normalized = normalizeMetadata(raw);
        metadata = {
          raw,
          name: normalized.name || fallback.title || null,
          description: normalized.description || fallback.description || null,
          imageUrl: normalizeImageUrl(
            normalized.imageUrl ||
              fallback.media?.[0]?.gateway ||
              fallback.media?.[0]?.raw ||
              null
          ),
        };
        tokenUri = fallback.tokenUri?.raw || fallback.tokenUri?.gateway || null;
      }
      await pool.execute(
        `UPDATE gallery_items
         SET token_uri = ?, metadata_json = ?, image_url = ?, name = ?, description = ?
         WHERE gallery_id = ? AND item_key = ?`,
        [
          tokenUri,
          JSON.stringify(metadata.raw),
          metadata.imageUrl,
          metadata.name,
          metadata.description,
          row.galleryId,
          row.itemKey,
        ]
      );
      processed += 1;
      console.log(`Updated ${row.galleryId}:${row.itemKey}`);
    } catch (err) {
      console.warn(
        `Failed ${row.galleryId}:${row.itemKey} - ${err instanceof Error ? err.message : err}`
      );
    }
  }

  console.log(`Backfill complete. Updated ${processed} items.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
