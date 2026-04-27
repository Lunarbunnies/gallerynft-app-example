const fs = require("fs");
const path = require("path");
const { keccak_256 } = require("@noble/hashes/sha3");

const MOCK_EVENTS_PATH = process.env.MOCK_EVENTS_PATH || "mock/events.json";
const RANDOM_ITEM_COUNT = Number(process.env.MOCK_RANDOM_ITEM_COUNT || 0);
const FEATURED_EVM_ITEMS = [
  {
    chainId: 8453n,
    contract: "0x518e280f0b9bfc837844b955dd02cb4eb1a0bd3a",
    tokenId: 1n,
    label: "Featured Base NFT #1",
    note: "Base reference seed (may be ERC-1155 or ERC-721).",
  },
  {
    chainId: 1n,
    contract: "0xa9b60950a3d0461c1430b9fcba57d284be4a8788",
    tokenId: 257n,
    label: "Featured ETH NFT #257",
    note: "Ethereum reference seed.",
  },
  {
    chainId: 1n,
    contract: "0xe22f47f5986c816e2e0519c200cbaf10aab3239b",
    tokenId: 2n,
    label: "Featured ETH NFT #2",
    note: "Ethereum reference seed.",
  },
];

function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randHex(rng, bytes) {
  const buf = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i += 1) {
    buf[i] = randInt(rng, 0, 255);
  }
  return buf;
}

function writeUint64BE(buf, offset, value) {
  let v = BigInt(value);
  for (let i = 7; i >= 0; i -= 1) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function writeUint96BE(buf, offset, value) {
  let v = BigInt(value);
  for (let i = 11; i >= 0; i -= 1) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function encodeEvmPackedRef(chainId, contract, tokenId) {
  const buf = Buffer.alloc(41);
  buf[0] = 0x00;
  writeUint64BE(buf, 1, chainId);
  contract.copy(buf, 9);
  writeUint96BE(buf, 29, tokenId);
  return buf;
}

function encodeTezosPackedRef(net, contractHash, tokenId) {
  const buf = Buffer.alloc(30);
  buf[0] = 0x01;
  buf[1] = net & 0xff;
  contractHash.copy(buf, 2);
  writeUint64BE(buf, 22, tokenId);
  return buf;
}

function keccakHex(buffer) {
  const hash = keccak_256(buffer);
  return `0x${Buffer.from(hash).toString("hex")}`;
}

function parseHex20(hexAddress) {
  const normalized = String(hexAddress).toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`Invalid 20-byte hex address: ${hexAddress}`);
  }
  return Buffer.from(normalized, "hex");
}

function main() {
  const rng = createRng(1337);
  const events = [];
  let eventId = 1;

  const galleryCount = Number(process.env.MOCK_GALLERY_COUNT || 1);
  const startTime = Math.floor(Date.now() / 1000);
  for (let g = 1; g <= galleryCount; g += 1) {
    const owner = `0x${randHex(rng, 20).toString("hex")}`;
    const createdAt = startTime + g * 10;
    events.push({
      type: "GalleryCreated",
      id: eventId++,
      galleryId: g,
      owner,
      createdAt,
    });
    events.push({
      type: "GalleryFieldsUpdated",
      id: eventId++,
      galleryId: g,
      title: `Gallery ${g}`,
      description: `On-chain curated set ${g}`,
      updatedAt: createdAt + 1,
    });

    const items = [];
    let displayOrder = 1;

    if (g === 1) {
      for (const featured of FEATURED_EVM_ITEMS) {
        const packedRef = encodeEvmPackedRef(
          featured.chainId,
          parseHex20(featured.contract),
          featured.tokenId
        );
        const packedRefHex = `0x${packedRef.toString("hex")}`;
        const itemKey = keccakHex(packedRef);
        items.push({ itemKey, packedRefHex });

        const addedAt = createdAt + 100 + displayOrder;
        events.push({
          type: "ItemAdded",
          id: eventId++,
          galleryId: g,
          packedRefHex,
          itemKey,
          addedAt,
        });
        events.push({
          type: "ItemFieldsUpdated",
          id: eventId++,
          galleryId: g,
          itemKey,
          displayOrder,
          label: featured.label,
          note: featured.note,
        });

        displayOrder += 1;
      }
    }

    const itemCount = Math.max(0, RANDOM_ITEM_COUNT);
    for (let i = 0; i < itemCount; i += 1) {
      const useTezos = rng() < 0.4;
      let packedRef;
      if (useTezos) {
        const net = randInt(rng, 0, 2);
        const contractHash = randHex(rng, 20);
        const tokenId = randInt(rng, 1, 100000);
        packedRef = encodeTezosPackedRef(net, contractHash, tokenId);
      } else {
        const chainId = rng() < 0.5 ? 1 : 137;
        const contract = randHex(rng, 20);
        const tokenId = randInt(rng, 1, 1000000);
        packedRef = encodeEvmPackedRef(chainId, contract, tokenId);
      }

      const packedRefHex = `0x${packedRef.toString("hex")}`;
      const itemKey = keccakHex(packedRef);
      items.push({ itemKey, packedRefHex });
      const addedAt = createdAt + 100 + displayOrder;

      events.push({
        type: "ItemAdded",
        id: eventId++,
        galleryId: g,
        packedRefHex,
        itemKey,
        addedAt,
      });
      events.push({
        type: "ItemFieldsUpdated",
        id: eventId++,
        galleryId: g,
        itemKey,
        displayOrder,
        label: `Item ${displayOrder}`,
        note: `Curated note for item ${displayOrder}`,
      });

      displayOrder += 1;
    }

    for (const item of items) {
      if (rng() < 0.1) {
        events.push({
          type: "ItemRemoved",
          id: eventId++,
          galleryId: g,
          itemKey: item.itemKey,
          removedAt: createdAt + 1000,
        });
      }
    }
  }

  const outPath = path.resolve(MOCK_EVENTS_PATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(events, null, 2));
  console.log(`Wrote ${events.length} events to ${outPath}`);
}

main();
