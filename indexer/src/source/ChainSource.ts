import { Contract, Interface, JsonRpcProvider, Log } from "ethers";
import { ChainEvent } from "../types";

const EVENT_ID_MULTIPLIER = 100000;
const DEFAULT_BLOCK_SPAN = 10000;
const DEFAULT_CONFIRMATIONS = 12;

const FACTORY_ABI = [
  "event CollectionCreated(address indexed collection, address indexed creator, string name, string symbol)",
  "function getCollectionsByCreator(address creator) view returns (address[] collections)",
];

const GALLERY_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "event GalleryCreated(uint256 indexed galleryId, address indexed owner)",
  "event GalleryFieldsUpdated(uint256 indexed galleryId, string title, string description)",
  "event ItemAdded(uint256 indexed galleryId, bytes32 indexed itemKey, bytes packedRef)",
  "event ItemFieldsUpdated(uint256 indexed galleryId, bytes32 indexed itemKey, uint32 displayOrder, string label, string note)",
  "event ItemRemoved(uint256 indexed galleryId, bytes32 indexed itemKey)",
];

type CollectionInfo = {
  address: string;
  creator: string;
  name: string;
  symbol: string;
  createdAt: number;
};

type FactoryInfo = {
  address: string;
  fromBlock: number;
};

function normalizeAddress(value: string) {
  return value.trim();
}

function splitAddresses(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitFactorySpecs(value?: string) {
  if (!value) return [] as FactoryInfo[];
  return value
    .split(",")
    .map((part) => {
      const [address, fromBlock] = part.trim().split("@");
      if (!address) return null;
      return {
        address: normalizeAddress(address),
        fromBlock: fromBlock ? Number(fromBlock) : 0,
      };
    })
    .filter((factory): factory is FactoryInfo => Boolean(factory?.address));
}

function dedupeFactories(factories: FactoryInfo[]) {
  const byAddress = new Map<string, FactoryInfo>();
  for (const factory of factories) {
    const key = factory.address.toLowerCase();
    const existing = byAddress.get(key);
    if (!existing || (factory.fromBlock > 0 && factory.fromBlock < existing.fromBlock)) {
      byAddress.set(key, factory);
    }
  }
  return Array.from(byAddress.values());
}

function eventId(log: Log) {
  return Number(log.blockNumber) * EVENT_ID_MULTIPLIER + Number(log.index);
}

async function blockTimestamp(provider: JsonRpcProvider, blockNumber: number) {
  const block = await provider.getBlock(blockNumber);
  return Number(block?.timestamp ?? Math.floor(Date.now() / 1000));
}

export class ChainSource {
  private provider: JsonRpcProvider;
  private factories: FactoryInfo[];
  private explicitCollections: string[];
  private factoryInterface = new Interface(FACTORY_ABI);
  private galleryInterface = new Interface(GALLERY_ABI);
  private knownCollections = new Map<string, CollectionInfo>();
  private fromBlock: number;
  private blockSpan: number;
  private confirmations: number;
  private blockTimestampCache = new Map<number, number>();

  constructor() {
    const rpcUrl =
      process.env.INDEXER_RPC_URL ||
      process.env.SEPOLIA_RPC_URL ||
      process.env.MAINNET_RPC_URL;
    if (!rpcUrl) {
      throw new Error("INDEXER_RPC_URL, SEPOLIA_RPC_URL, or MAINNET_RPC_URL is required");
    }

    this.provider = new JsonRpcProvider(rpcUrl);
    this.factories = dedupeFactories([
      ...splitFactorySpecs(process.env.INDEXER_FACTORY_ADDRESSES),
      ...splitFactorySpecs(process.env.INDEXER_FACTORY_ADDRESS || process.env.NEXT_PUBLIC_GALLERYNFT_FACTORY_ADDRESS),
    ]);
    this.explicitCollections = splitAddresses(process.env.INDEXER_COLLECTION_ADDRESSES);
    const configuredStartBlock = Number(process.env.INDEXER_START_BLOCK || 0);
    const factoryStartBlocks = this.factories
      .map((factory) => factory.fromBlock)
      .filter((fromBlock) => fromBlock > 0);
    this.fromBlock =
      factoryStartBlocks.length > 0
        ? Math.min(configuredStartBlock || Number.MAX_SAFE_INTEGER, ...factoryStartBlocks)
        : configuredStartBlock;
    this.blockSpan = Number(process.env.INDEXER_BLOCK_SPAN || DEFAULT_BLOCK_SPAN);
    this.confirmations = Number(process.env.INDEXER_CONFIRMATIONS || DEFAULT_CONFIRMATIONS);
  }

  private async cachedBlockTimestamp(blockNumber: number) {
    const cached = this.blockTimestampCache.get(blockNumber);
    if (cached) return cached;
    const timestamp = await blockTimestamp(this.provider, blockNumber);
    this.blockTimestampCache.set(blockNumber, timestamp);
    return timestamp;
  }

  private async readCollectionMetadata(address: string) {
    const contract = new Contract(address, GALLERY_ABI, this.provider);
    try {
      const [name, symbol] = await Promise.all([contract.name(), contract.symbol()]);
      return { name: String(name), symbol: String(symbol) };
    } catch (_err) {
      return { name: "Imported GalleryNFT", symbol: "GALLERY" };
    }
  }

  private async ensureKnownCollections(toBlock: number) {
    for (const address of this.explicitCollections) {
      const key = address.toLowerCase();
      if (!this.knownCollections.has(key)) {
        const metadata = await this.readCollectionMetadata(address);
        this.knownCollections.set(key, {
          address: normalizeAddress(address),
          creator: "0x0000000000000000000000000000000000000000",
          name: metadata.name,
          symbol: metadata.symbol,
          createdAt: 0,
        });
      }
    }

    for (const factory of this.factories) {
      const logs = await this.provider.getLogs({
        address: factory.address,
        fromBlock: Math.max(this.fromBlock, factory.fromBlock),
        toBlock,
        topics: [this.factoryInterface.getEvent("CollectionCreated")!.topicHash],
      });

      for (const log of logs) {
        const parsed = this.factoryInterface.parseLog(log);
        if (!parsed || parsed.name !== "CollectionCreated") continue;
        const address = String(parsed.args.collection);
        const key = address.toLowerCase();
        this.knownCollections.set(key, {
          address,
          creator: String(parsed.args.creator),
          name: String(parsed.args.name),
          symbol: String(parsed.args.symbol),
          createdAt: await this.cachedBlockTimestamp(Number(log.blockNumber)),
        });
      }
    }
  }

  private async factoryEvents(afterId: number, fromBlock: number, toBlock: number) {
    const events: ChainEvent[] = [];
    for (const factory of this.factories) {
      const effectiveFromBlock = Math.max(fromBlock, factory.fromBlock);
      if (effectiveFromBlock > toBlock) continue;
      const logs = await this.provider.getLogs({
        address: factory.address,
        fromBlock: effectiveFromBlock,
        toBlock,
        topics: [this.factoryInterface.getEvent("CollectionCreated")!.topicHash],
      });

      for (const log of logs) {
        const id = eventId(log);
        if (id <= afterId) continue;
        const parsed = this.factoryInterface.parseLog(log);
        if (!parsed || parsed.name !== "CollectionCreated") continue;
        events.push({
          type: "CollectionCreated",
          id,
          collectionAddress: String(parsed.args.collection),
          creator: String(parsed.args.creator),
          name: String(parsed.args.name),
          symbol: String(parsed.args.symbol),
          createdAt: await this.cachedBlockTimestamp(Number(log.blockNumber)),
        });
      }
    }

    return events;
  }

  private explicitCollectionEvents(afterId: number) {
    return Array.from(this.knownCollections.values())
      .filter((collection) =>
        this.explicitCollections.some(
          (address) => address.toLowerCase() === collection.address.toLowerCase()
        )
      )
      .map((collection, index) => ({
        type: "CollectionCreated" as const,
        id: this.fromBlock * EVENT_ID_MULTIPLIER + 50000 + index,
        collectionAddress: collection.address,
        creator: collection.creator,
        name: collection.name,
        symbol: collection.symbol,
        createdAt: collection.createdAt,
      }))
      .filter((event) => event.id > afterId);
  }

  private async galleryEvents(afterId: number, fromBlock: number, toBlock: number) {
    const collections = Array.from(this.knownCollections.values());
    if (collections.length === 0) return [] as ChainEvent[];

    const events: ChainEvent[] = [];
    for (const collection of collections) {
      const logs = await this.provider.getLogs({
        address: collection.address,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        const id = eventId(log);
        if (id <= afterId) continue;
        const parsed = this.galleryInterface.parseLog(log);
        if (!parsed) continue;
        const timestamp = await this.cachedBlockTimestamp(Number(log.blockNumber));

        if (parsed.name === "GalleryCreated") {
          events.push({
            type: "GalleryCreated",
            id,
            collectionAddress: collection.address,
            galleryId: Number(parsed.args.galleryId),
            owner: String(parsed.args.owner),
            createdAt: timestamp,
          });
        } else if (parsed.name === "GalleryFieldsUpdated") {
          events.push({
            type: "GalleryFieldsUpdated",
            id,
            collectionAddress: collection.address,
            galleryId: Number(parsed.args.galleryId),
            title: String(parsed.args.title),
            description: String(parsed.args.description),
            updatedAt: timestamp,
          });
        } else if (parsed.name === "ItemAdded") {
          events.push({
            type: "ItemAdded",
            id,
            collectionAddress: collection.address,
            galleryId: Number(parsed.args.galleryId),
            itemKey: String(parsed.args.itemKey),
            packedRefHex: String(parsed.args.packedRef),
            addedAt: timestamp,
          });
        } else if (parsed.name === "ItemFieldsUpdated") {
          events.push({
            type: "ItemFieldsUpdated",
            id,
            collectionAddress: collection.address,
            galleryId: Number(parsed.args.galleryId),
            itemKey: String(parsed.args.itemKey),
            displayOrder: Number(parsed.args.displayOrder),
            label: String(parsed.args.label),
            note: String(parsed.args.note),
          });
        } else if (parsed.name === "ItemRemoved") {
          events.push({
            type: "ItemRemoved",
            id,
            collectionAddress: collection.address,
            galleryId: Number(parsed.args.galleryId),
            itemKey: String(parsed.args.itemKey),
            removedAt: timestamp,
          });
        }
      }
    }
    return events;
  }

  async getNextEvents(afterId: number, limit: number): Promise<ChainEvent[]> {
    const latest = Math.max(0, (await this.provider.getBlockNumber()) - this.confirmations);
    const afterBlock = Math.floor(afterId / EVENT_ID_MULTIPLIER);
    const fromBlock = Math.max(this.fromBlock, afterId === 0 ? this.fromBlock : afterBlock + 1);
    if (fromBlock > latest) return [];
    const toBlock = Math.min(latest, fromBlock + this.blockSpan);

    await this.ensureKnownCollections(toBlock);
    const events = [
      ...this.explicitCollectionEvents(afterId),
      ...(await this.factoryEvents(afterId, fromBlock, toBlock)),
      ...(await this.galleryEvents(afterId, fromBlock, toBlock)),
    ].sort((a, b) => a.id - b.id);

    if (events.length > 0) return events.slice(0, limit);
    if (toBlock < latest) {
      return [{ type: "Checkpoint", id: (toBlock + 1) * EVENT_ID_MULTIPLIER - 1 }];
    }
    return [];
  }
}
