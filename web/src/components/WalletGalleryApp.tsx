"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, toUtf8Bytes } from "ethers";
import {
  GALLERY_NFT_ABI,
  GALLERY_NFT_ADDRESS,
  GALLERY_NFT_CHAIN_ID,
  GALLERY_NFT_EXPLORER_BASE_URL,
  GALLERY_NFT_FEATURE_EXTRA_DATA,
  GALLERY_NFT_FACTORY_ABI,
  GALLERY_NFT_FACTORY_ADDRESS,
  GALLERY_NFT_FACTORY_VERSION,
  GALLERY_NFT_SCHEMA_ITEM_DISPLAY,
  GALLERY_NFT_SCHEMA_ITEM_WALLTEXT,
  isAddressLike,
  isFactoryModeEnabled,
  isWalletModeEnabled,
} from "../lib/galleryContract";
import { encodeEvmPackedRef, encodeTezosPackedRef, itemKeyFromPackedRef } from "../lib/browserPackedRef";

type DraftItem = {
  id: string;
  kind: "evm" | "tezos";
  chainId: string;
  contractAddress: string;
  tokenId: string;
  label: string;
  note: string;
};

type DraftGallery = {
  id: string;
  title: string;
  description: string;
  items: DraftItem[];
  collectionAddress?: string;
  mintedGalleryId?: number;
  txHash?: string;
};

type Collection = {
  address: string;
  name: string;
  symbol: string;
  source: "env" | "factory" | "manual";
  version?: string | null;
};

type IndexedGallery = {
  collectionAddress: string;
  galleryId: number;
  owner: string;
  title: string | null;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
  txHash?: string;
  syncStatus?: "indexed" | "pending";
};

type IndexedGalleryItem = {
  itemKey: string;
  packedRefHex: string;
  displayOrder: number | null;
  label: string | null;
  note: string | null;
  tokenUri?: string | null;
  metadataJson?: unknown | null;
  imageUrl?: string | null;
  animationUrl?: string | null;
  animationMime?: string | null;
  name?: string | null;
  description?: string | null;
  artist?: string | null;
  fetchError?: string | null;
};

type IndexedDetail = {
  gallery: IndexedGallery;
  items: IndexedGalleryItem[];
};

type DecodedTokenUri = {
  raw: string;
  metadata: any | null;
};

type ItemExtraForm = {
  wallText: string;
  displayFit: string;
  displayBackground: string;
  preferredMedia: string;
};

type AppView = "dashboard" | "create";

const DRAFT_STORAGE_KEY = "gallerynft:drafts:v2";
const COLLECTION_STORAGE_KEY = "gallerynft:collections:v1";
const HIDDEN_GALLERIES_STORAGE_KEY = "gallerynft:hidden-galleries:v1";

function makeItemExtraDefaults(): ItemExtraForm {
  return {
    wallText: "",
    displayFit: "contain",
    displayBackground: "#000000",
    preferredMedia: "image",
  };
}

const buttonStyle = {
  padding: "7px 10px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "var(--panel)",
  color: "var(--text)",
  cursor: "pointer",
} as const;

const inputStyle = {
  padding: "8px",
  border: "1px solid var(--border)",
  borderRadius: "6px",
  background: "var(--panel)",
  color: "var(--text)",
} as const;

const panelStyle = {
  border: "1px solid var(--border)",
  borderRadius: "10px",
  padding: "12px",
  background: "var(--panel)",
} as const;

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "8px",
  alignItems: "start",
} as const;

const containedMediaStyle = {
  width: "100%",
  height: "100%",
  maxWidth: "100%",
  maxHeight: "100%",
  display: "block",
  objectFit: "contain",
  overflow: "hidden",
} as const;

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function shortAddress(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

function sourceLabel(source: Collection["source"]) {
  if (source === "env") return "Configured";
  if (source === "factory") return "Factory";
  return "Imported";
}

function galleryStorageKey(collectionAddress: string, galleryId: number) {
  return `${collectionAddress.toLowerCase()}:${galleryId}`;
}

function txUrl(txHash?: string) {
  if (!txHash || !GALLERY_NFT_EXPLORER_BASE_URL) return "";
  return `${GALLERY_NFT_EXPLORER_BASE_URL.replace(/\/$/, "")}/tx/${txHash}`;
}

function dedupeCollections(collections: Collection[]) {
  const seen = new Set<string>();
  const out: Collection[] = [];
  for (const collection of collections) {
    const key = collection.address.toLowerCase();
    if (!isAddressLike(collection.address) || seen.has(key)) continue;
    seen.add(key);
    out.push(collection);
  }
  return out;
}

function parseItemUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.hostname.toLowerCase().includes("objkt.com")) {
    if (parts[0] !== "tokens" || parts.length < 3) return null;
    return {
      kind: "tezos" as const,
      chainId: "tezos",
      contractAddress: parts[1],
      tokenId: parts[2],
    };
  }

  if (!url.hostname.toLowerCase().includes("opensea.io")) return null;
  if (parts[0] !== "item" || parts.length < 4) return null;

  const chainMap: Record<string, string> = {
    ethereum: "1",
    sepolia: "11155111",
    base: "8453",
    polygon: "137",
    matic: "137",
    abstract: "2741",
  };
  const chainId = chainMap[parts[1].toLowerCase()];
  if (!chainId) return null;
  return { kind: "evm" as const, chainId, contractAddress: parts[2], tokenId: parts[3] };
}

function isHtmlLike(url: string | null | undefined, mime?: string | null) {
  if (!url) return false;
  const lower = url.toLowerCase();
  const lowerMime = mime?.toLowerCase() || "";
  return (
    lower.startsWith("data:text/html") ||
    lower.endsWith(".html") ||
    lower.endsWith("/") ||
    lowerMime === "html" ||
    lowerMime.includes("text/html") ||
    lowerMime.includes("application/xhtml")
  );
}

function isVideoLike(url: string | null | undefined, mime?: string | null) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".mov") ||
    lower.includes("/mp4") ||
    mime?.toLowerCase().includes("video") === true
  );
}

function isInteractiveSvg(url: string | null | undefined, mime?: string | null) {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.startsWith("data:image/svg") ||
    lower.endsWith(".svg") ||
    mime?.toLowerCase().includes("svg") === true
  );
}

function resolveMediaSourceUrl(url: string | null | undefined) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${url.replace("ipfs://", "")}`;
  }
  if (url.startsWith("ar://")) {
    return `https://arweave.net/${url.replace("ar://", "")}`;
  }
  return url;
}

function metadataMime(metadata: any, rawUrl: string | null, resolvedUrl: string | null) {
  const explicit = metadata?.animation_details?.format;
  if (explicit) return String(explicit);
  const formats = Array.isArray(metadata?.formats) ? metadata.formats : [];
  const matched = formats.find((format: any) => {
    if (!format?.uri) return false;
    return format.uri === rawUrl || resolveMediaSourceUrl(format.uri) === resolvedUrl;
  });
  const rich = formats.find((format: any) => {
    const mime = String(format?.mimeType || "").toLowerCase();
    return mime.includes("html") || mime.includes("video") || mime.includes("svg");
  });
  return matched?.mimeType || rich?.mimeType || null;
}

function proxiedMediaUrl(url: string) {
  if (url.startsWith("data:")) return url;
  return `/api/media?url=${encodeURIComponent(url)}`;
}

function needsMediaTypeSniff(url: string | null) {
  if (!url || url.startsWith("data:")) return false;
  return !/\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|m4v|html)(\?|#|$)/i.test(url);
}

function MediaPreview({ item }: { item: IndexedGalleryItem }) {
  const [sniffedMime, setSniffedMime] = useState<string | null>(null);
  const [isSniffing, setIsSniffing] = useState(false);
  const metadata = item.metadataJson as any;
  const rawMediaUrl =
    item.animationUrl ||
    metadata?.animation_url ||
    metadata?.animationUrl ||
    metadata?.artifactUri ||
    item.imageUrl ||
    metadata?.image_url ||
    metadata?.image ||
    metadata?.displayUri ||
    metadata?.thumbnailUri ||
    null;
  const mediaUrl = resolveMediaSourceUrl(rawMediaUrl);
  const mediaMime = item.animationMime || metadataMime(metadata, rawMediaUrl, mediaUrl);

  useEffect(() => {
    let cancelled = false;
    setSniffedMime(null);
    if (!needsMediaTypeSniff(mediaUrl)) return;

    setIsSniffing(true);
    fetch(`/api/media/info?url=${encodeURIComponent(mediaUrl || "")}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setSniffedMime(data?.contentType || null);
      })
      .catch(() => {
        if (!cancelled) setSniffedMime(null);
      })
      .finally(() => {
        if (!cancelled) setIsSniffing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaUrl]);

  if (!mediaUrl) {
    return (
      <div>
        <div style={{ fontWeight: 700 }}>{item.name || item.label || "Untitled item"}</div>
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
          {item.fetchError || "Resolving media..."}
        </div>
      </div>
    );
  }

  const effectiveMime = sniffedMime || mediaMime;
  if (needsMediaTypeSniff(mediaUrl) && isSniffing && !sniffedMime) {
    return (
      <div>
        <div style={{ fontWeight: 700 }}>{item.name || item.label || "Untitled item"}</div>
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>Resolving media type...</div>
      </div>
    );
  }

  if (isHtmlLike(mediaUrl, effectiveMime) || isInteractiveSvg(mediaUrl, effectiveMime)) {
    return (
      <iframe
        src={proxiedMediaUrl(mediaUrl)}
        sandbox="allow-scripts allow-same-origin"
        title={item.name || item.label || item.itemKey}
        style={{ ...containedMediaStyle, border: 0, background: "#fff" }}
      />
    );
  }

  if (isVideoLike(mediaUrl, effectiveMime)) {
    return (
      <video
        src={proxiedMediaUrl(mediaUrl)}
        controls
        muted
        loop
        playsInline
        style={containedMediaStyle}
      />
    );
  }

  return (
    <img
      src={proxiedMediaUrl(mediaUrl)}
      alt={item.name || item.label || "NFT preview"}
      style={containedMediaStyle}
    />
  );
}

function TokenUriImagePreview({ metadata }: { metadata: any }) {
  const image = resolveMediaSourceUrl(typeof metadata?.image === "string" ? metadata.image : null);
  if (!image) return null;

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <div style={{ fontSize: "12px", color: "var(--muted)" }}>image</div>
      <div
        style={{
          width: "min(100%, 360px)",
          aspectRatio: "1 / 1",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          background: "var(--panel-2)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        <img
          src={proxiedMediaUrl(image)}
          alt={typeof metadata?.name === "string" ? metadata.name : "tokenURI image"}
          style={containedMediaStyle}
        />
      </div>
      <div style={{ fontSize: "12px", color: "var(--muted)", overflowWrap: "anywhere" }}>
        {image}
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: "4px", fontSize: "12px", color: "var(--muted)" }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function WalletGalleryApp() {
  const [view, setView] = useState<AppView>("dashboard");
  const [drafts, setDrafts] = useState<DraftGallery[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [wallet, setWallet] = useState("");
  const [title, setTitle] = useState("Untitled Gallery");
  const [description, setDescription] = useState("");
  const [collectionName, setCollectionName] = useState("My On-Chain Galleries");
  const [collectionSymbol, setCollectionSymbol] = useState("GALLERY");
  const [manualCollection, setManualCollection] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [item, setItem] = useState({
    kind: "evm" as "evm" | "tezos",
    chainId: "1",
    contractAddress: "",
    tokenId: "",
    label: "",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isDeployingCollection, setIsDeployingCollection] = useState(false);
  const [isRefreshingCollections, setIsRefreshingCollections] = useState(false);
  const [isLoadingIndexed, setIsLoadingIndexed] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
  const [isNotifyingMarketplaces, setIsNotifyingMarketplaces] = useState(false);
  const [isSavingIndexed, setIsSavingIndexed] = useState(false);
  const [isSavingExtraData, setIsSavingExtraData] = useState(false);
  const [isLoadingTokenUri, setIsLoadingTokenUri] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [indexedGalleries, setIndexedGalleries] = useState<IndexedGallery[]>([]);
  const [hiddenGalleryKeys, setHiddenGalleryKeys] = useState<string[]>([]);
  const [selectedIndexed, setSelectedIndexed] = useState<{
    collectionAddress: string;
    galleryId: number;
  } | null>(null);
  const [indexedDetail, setIndexedDetail] = useState<IndexedDetail | null>(null);
  const [contractFeatures, setContractFeatures] = useState<
    Record<string, { version: string | null; hasExtraData: boolean }>
  >({});
  const [indexedEdit, setIndexedEdit] = useState<{
    title: string;
    description: string;
    items: Record<string, { displayOrder: string; label: string; note: string }>;
  } | null>(null);
  const [itemExtraForms, setItemExtraForms] = useState<Record<string, ItemExtraForm>>({});
  const [tokenUri, setTokenUri] = useState<DecodedTokenUri | null>(null);
  const [fullPreviewItem, setFullPreviewItem] = useState<IndexedGalleryItem | null>(null);
  const walletMode = isWalletModeEnabled();
  const factoryMode = isFactoryModeEnabled();

  useEffect(() => {
    let parsedCollections: Collection[] = [];
    const savedCollections = window.localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (savedCollections) {
      try {
        parsedCollections = JSON.parse(savedCollections) as Collection[];
      } catch (_err) {
        window.localStorage.removeItem(COLLECTION_STORAGE_KEY);
      }
    }
    const seeded = GALLERY_NFT_ADDRESS
      ? [
          {
            address: GALLERY_NFT_ADDRESS,
            name: "Configured GalleryNFT",
            symbol: "GALLERY",
            source: "env" as const,
            version: null,
          },
          ...parsedCollections,
        ]
      : parsedCollections;
    const cleanCollections = dedupeCollections(seeded);
    setCollections(cleanCollections);
    setSelectedCollection(cleanCollections[0]?.address ?? "");

    const savedDrafts = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!savedDrafts) return;
    try {
      const parsedDrafts = JSON.parse(savedDrafts) as DraftGallery[];
      setDrafts(parsedDrafts);
      setSelectedId(parsedDrafts[0]?.id ?? null);
    } catch (_err) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }

    const savedHidden = window.localStorage.getItem(HIDDEN_GALLERIES_STORAGE_KEY);
    if (savedHidden) {
      try {
        setHiddenGalleryKeys(JSON.parse(savedHidden) as string[]);
      } catch (_err) {
        window.localStorage.removeItem(HIDDEN_GALLERIES_STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    loadIndexedDashboard();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    const localOnly = collections.filter((collection) => collection.source !== "env");
    window.localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(localOnly));
  }, [collections]);

  useEffect(() => {
    window.localStorage.setItem(HIDDEN_GALLERIES_STORAGE_KEY, JSON.stringify(hiddenGalleryKeys));
  }, [hiddenGalleryKeys]);

  const selected = useMemo(
    () => drafts.find((draft) => draft.id === selectedId) || null,
    [drafts, selectedId]
  );

  const mintedDrafts = useMemo(
    () => drafts.filter((draft) => draft.mintedGalleryId && draft.collectionAddress),
    [drafts]
  );

  const filteredIndexedGalleries = useMemo(
    () =>
      indexedGalleries.filter(
        (gallery) =>
          !hiddenGalleryKeys.includes(galleryStorageKey(gallery.collectionAddress, gallery.galleryId)) &&
          (!selectedCollection ||
            gallery.collectionAddress.toLowerCase() === selectedCollection.toLowerCase())
      ),
    [hiddenGalleryKeys, indexedGalleries, selectedCollection]
  );

  async function loadIndexedDashboard(owner?: string) {
    setIsLoadingIndexed(true);
    try {
      const url = owner ? `/api/indexed?owner=${encodeURIComponent(owner)}` : "/api/indexed";
      const response = await fetch(url);
      if (!response.ok) return;
      const data = (await response.json()) as {
        collections?: Array<{
          collectionAddress: string;
          creatorAddress: string;
          name: string;
          symbol: string;
        }>;
        galleries?: IndexedGallery[];
      };
      const loadedGalleries = (data.galleries || []).map((gallery) => ({
        ...gallery,
        syncStatus: "indexed" as const,
      }));
      setIndexedGalleries((prev) => {
        const loadedKeys = new Set(
          loadedGalleries.map((gallery) => galleryStorageKey(gallery.collectionAddress, gallery.galleryId))
        );
        const stillPending = prev.filter(
          (gallery) =>
            gallery.syncStatus === "pending" &&
            !loadedKeys.has(galleryStorageKey(gallery.collectionAddress, gallery.galleryId))
        );
        const txHashes = new Map(
          prev
            .filter((gallery) => gallery.txHash)
            .map((gallery) => [
              galleryStorageKey(gallery.collectionAddress, gallery.galleryId),
              gallery.txHash,
            ])
        );
        return [
          ...stillPending,
          ...loadedGalleries.map((gallery) => ({
            ...gallery,
            txHash: txHashes.get(galleryStorageKey(gallery.collectionAddress, gallery.galleryId)),
          })),
        ];
      });
      const indexedCollections = (data.collections || []).map((collection) => ({
        address: collection.collectionAddress,
        name: collection.name,
        symbol: collection.symbol,
        source: "factory" as const,
        version: null,
      }));
      setCollections((prev) => dedupeCollections([...prev, ...indexedCollections]));
      if (selectedIndexed) {
        await reloadIndexedDetail();
      }
    } finally {
      setIsLoadingIndexed(false);
    }
  }

  async function selectIndexedGallery(gallery: IndexedGallery) {
    setError(null);
    setSelectedIndexed({
      collectionAddress: gallery.collectionAddress,
      galleryId: gallery.galleryId,
    });
    setSelectedId(null);
    setSelectedCollection(gallery.collectionAddress);
    setIndexedDetail(null);
    let detail: IndexedDetail | null = null;
    try {
      detail = await readGalleryDirect(gallery);
    } catch (_err) {
      detail = null;
    }
    if (!detail) {
      if (gallery.syncStatus !== "pending") {
        const response = await fetch(
          `/api/indexed/galleries/${gallery.collectionAddress}/${gallery.galleryId}`
        );
        if (response.ok) {
          detail = (await response.json()) as IndexedDetail;
        }
      }
    }
    if (!detail) {
      setError("Could not read gallery from contract or indexed cache");
      return;
    }
    applyIndexedDetail(detail);
    setTokenUri(null);
    void hydrateDirectMetadata(detail);
    void loadContractFeatures(gallery.collectionAddress);
  }

  function applyIndexedDetail(detail: IndexedDetail) {
    setIndexedDetail(detail);
    setIndexedEdit({
      title: detail.gallery.title || "",
      description: detail.gallery.description || "",
      items: Object.fromEntries(
        detail.items.map((item, index) => [
          item.itemKey,
          {
            displayOrder: String(item.displayOrder ?? index + 1),
            label: item.label || "",
            note: item.note || "",
          },
        ])
      ),
    });
    setItemExtraForms(
      Object.fromEntries(detail.items.map((item) => [item.itemKey, makeItemExtraDefaults()]))
    );
  }

  async function hydrateDirectMetadata(detail: IndexedDetail) {
    const missing = detail.items.filter(
      (item) => item.packedRefHex && !item.imageUrl && !item.animationUrl && !item.fetchError
    );
    if (missing.length === 0) return;

    try {
      const response = await fetch("/api/metadata/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: missing.map((item) => ({
            itemKey: item.itemKey,
            packedRefHex: item.packedRefHex,
          })),
        }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as { items?: IndexedGalleryItem[] };
      const resolved = new Map((data.items || []).map((item) => [item.itemKey, item]));
      const mergeItems = (items: IndexedGalleryItem[]) =>
        items.map((item) => {
          const metadata = resolved.get(item.itemKey);
          return metadata ? { ...item, ...metadata, itemKey: item.itemKey, packedRefHex: item.packedRefHex } : item;
        });

      setIndexedDetail((prev) => {
        if (
          !prev ||
          prev.gallery.collectionAddress.toLowerCase() !== detail.gallery.collectionAddress.toLowerCase() ||
          prev.gallery.galleryId !== detail.gallery.galleryId
        ) {
          return prev;
        }
        return {
          ...prev,
          items: mergeItems(prev.items),
        };
      });
    } catch (_err) {
      // Metadata is display-only. Contract reads should remain usable if a token lookup fails.
    }
  }

  async function readGalleryDirect(gallery: IndexedGallery): Promise<IndexedDetail> {
    if (!window.ethereum) throw new Error("No EVM wallet found for contract reads.");
    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== GALLERY_NFT_CHAIN_ID) {
      throw new Error(`Switch wallet to chain ${GALLERY_NFT_CHAIN_ID}.`);
    }
    const contract = new Contract(gallery.collectionAddress, GALLERY_NFT_ABI, provider);
    const galleryId = BigInt(gallery.galleryId);
    const fields = await contract.getGallery(galleryId);
    const itemKeys = (await contract.getGalleryItems(galleryId)) as string[];
    const items = await Promise.all(
      itemKeys.map(async (itemKey, index) => {
        const [packedRefHex, itemFields, status] = await Promise.all([
          contract.getItemPackedRef(galleryId, itemKey),
          contract.getItemFields(galleryId, itemKey),
          contract.getItemStatus(galleryId, itemKey),
        ]);
        return {
          itemKey,
          packedRefHex: String(packedRefHex),
          displayOrder: Number(itemFields.displayOrder ?? itemFields[0] ?? index + 1),
          label: String(itemFields.label ?? itemFields[1] ?? ""),
          note: String(itemFields.note ?? itemFields[2] ?? ""),
          fetchError: status.isActive === false || status[2] === false ? "Removed item" : null,
        } satisfies IndexedGalleryItem;
      })
    );

    return {
      gallery: {
        ...gallery,
        title: String(fields.title ?? fields[0] ?? ""),
        description: String(fields.description ?? fields[1] ?? ""),
        createdAt: Number(fields.createdAt ?? fields[2] ?? gallery.createdAt),
        updatedAt: Number(fields.updatedAt ?? fields[3] ?? gallery.updatedAt),
        owner: String(fields.owner ?? fields[4] ?? gallery.owner),
        itemCount: items.length,
      },
      items,
    };
  }

  async function loadContractFeatures(collectionAddress: string) {
    if (!window.ethereum || contractFeatures[collectionAddress.toLowerCase()]) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== GALLERY_NFT_CHAIN_ID) return;
      const contract = new Contract(collectionAddress, GALLERY_NFT_ABI, provider);
      let version: string | null = null;
      let hasExtraData = false;
      try {
        version = String(await contract.contractVersion());
      } catch (_err) {
        version = null;
      }
      try {
        hasExtraData = Boolean(await contract.supportsGalleryNFTFeature(GALLERY_NFT_FEATURE_EXTRA_DATA));
      } catch (_err) {
        hasExtraData = false;
      }
      setContractFeatures((prev) => ({
        ...prev,
        [collectionAddress.toLowerCase()]: { version, hasExtraData },
      }));
    } catch (_err) {
      // Feature detection is informational; write paths still surface real errors.
    }
  }

  async function reloadIndexedDetail() {
    if (!selectedIndexed) return;
    const response = await fetch(
      `/api/indexed/galleries/${selectedIndexed.collectionAddress}/${selectedIndexed.galleryId}`
    );
    if (response.ok) {
      const detail = (await response.json()) as IndexedDetail;
      applyIndexedDetail(detail);
      void hydrateDirectMetadata(detail);
    }
  }

  function decodeTokenUri(raw: string): DecodedTokenUri {
    const prefix = "data:application/json;base64,";
    if (!raw.startsWith(prefix)) return { raw, metadata: null };
    try {
      return {
        raw,
        metadata: JSON.parse(atob(raw.slice(prefix.length))),
      };
    } catch (_err) {
      return { raw, metadata: null };
    }
  }

  async function loadTokenUri() {
    if (!indexedDetail) return;
    if (tokenUri) {
      setTokenUri(null);
      return;
    }
    setIsLoadingTokenUri(true);
    setError(null);
    try {
      const signer = await getSigner();
      const contract = new Contract(indexedDetail.gallery.collectionAddress, GALLERY_NFT_ABI, signer);
      const raw = await contract.tokenURI(BigInt(indexedDetail.gallery.galleryId));
      setTokenUri(decodeTokenUri(String(raw)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tokenURI");
    } finally {
      setIsLoadingTokenUri(false);
    }
  }

  function updateIndexedItemEdit(
    itemKey: string,
    fields: Partial<{ displayOrder: string; label: string; note: string }>
  ) {
    setIndexedEdit((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: {
          ...prev.items,
          [itemKey]: {
            ...(prev.items[itemKey] || { displayOrder: "", label: "", note: "" }),
            ...fields,
          },
        },
      };
    });
  }

  function updateItemExtraForm(itemKey: string, fields: Partial<ItemExtraForm>) {
    setItemExtraForms((prev) => ({
      ...prev,
      [itemKey]: {
        ...(prev[itemKey] || makeItemExtraDefaults()),
        ...fields,
      },
    }));
  }

  async function notifyMarketplaces() {
    if (!indexedDetail) return;
    setIsNotifyingMarketplaces(true);
    setError(null);
    try {
      const signer = await getSigner();
      const contract = new Contract(indexedDetail.gallery.collectionAddress, GALLERY_NFT_ABI, signer);
      await (await contract.notifyMetadataUpdate(BigInt(indexedDetail.gallery.galleryId))).wait();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not emit marketplace refresh signal");
    } finally {
      setIsNotifyingMarketplaces(false);
    }
  }

  async function saveItemExtraData(itemKey: string) {
    if (!indexedDetail) return;
    const form = itemExtraForms[itemKey] || makeItemExtraDefaults();
    setIsSavingExtraData(true);
    setError(null);
    try {
      const signer = await getSigner();
      const contract = new Contract(indexedDetail.gallery.collectionAddress, GALLERY_NFT_ABI, signer);
      const galleryId = BigInt(indexedDetail.gallery.galleryId);
      const wallTextPayload = JSON.stringify({
        body: form.wallText,
        language: "en",
      });
      const displayPayload = JSON.stringify({
        fit: form.displayFit,
        background: form.displayBackground,
        preferredMedia: form.preferredMedia,
      });

      await (
        await contract.setItemExtraData(
          galleryId,
          itemKey,
          GALLERY_NFT_SCHEMA_ITEM_WALLTEXT,
          toUtf8Bytes(wallTextPayload)
        )
      ).wait();
      await (
        await contract.setItemExtraData(
          galleryId,
          itemKey,
          GALLERY_NFT_SCHEMA_ITEM_DISPLAY,
          toUtf8Bytes(displayPayload)
        )
      ).wait();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save v1.1 extra data");
    } finally {
      setIsSavingExtraData(false);
    }
  }

  async function saveIndexedEdits() {
    if (!indexedDetail || !indexedEdit) return;
    setIsSavingIndexed(true);
    setError(null);
    try {
      const signer = await getSigner();
      const contract = new Contract(indexedDetail.gallery.collectionAddress, GALLERY_NFT_ABI, signer);
      const galleryId = BigInt(indexedDetail.gallery.galleryId);
      const currentTitle = indexedDetail.gallery.title || "";
      const currentDescription = indexedDetail.gallery.description || "";

      if (indexedEdit.title !== currentTitle || indexedEdit.description !== currentDescription) {
        await (await contract.setGalleryFields(galleryId, indexedEdit.title, indexedEdit.description)).wait();
      }

      for (const item of indexedDetail.items) {
        const fields = indexedEdit.items[item.itemKey];
        if (!fields) continue;
        const nextOrder = fields.displayOrder ? Number(fields.displayOrder) : 0;
        if (
          nextOrder !== (item.displayOrder ?? 0) ||
          fields.label !== (item.label || "") ||
          fields.note !== (item.note || "")
        ) {
          await (
            await contract.updateItemFields(
              galleryId,
              item.itemKey,
              nextOrder,
              fields.label,
              fields.note
            )
          ).wait();
        }
      }

      await reloadIndexedDetail();
      await loadIndexedDashboard(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save indexed edits");
    } finally {
      setIsSavingIndexed(false);
    }
  }

  async function addIndexedItem() {
    if (!indexedDetail) return;
    setIsSavingIndexed(true);
    setError(null);
    try {
      const packedRef =
        item.kind === "tezos"
          ? encodeTezosPackedRef(item.contractAddress, item.tokenId)
          : encodeEvmPackedRef(item.chainId, item.contractAddress, item.tokenId);
      const itemKey = itemKeyFromPackedRef(packedRef);
      const label = item.label.trim() || `Token #${item.tokenId}`;
      const note = item.note.trim();
      const displayOrder = indexedDetail.items.length + 1;
      const signer = await getSigner();
      const contract = new Contract(indexedDetail.gallery.collectionAddress, GALLERY_NFT_ABI, signer);
      await (
        await contract.addItem(
          BigInt(indexedDetail.gallery.galleryId),
          packedRef,
          displayOrder,
          label,
          note
        )
      ).wait();

      const nextItem: IndexedGalleryItem = {
        itemKey,
        packedRefHex: packedRef,
        displayOrder,
        label,
        note,
      };
      setIndexedDetail((prev) =>
        prev
          ? {
              gallery: { ...prev.gallery, itemCount: prev.gallery.itemCount + 1 },
              items: [...prev.items, nextItem],
            }
          : prev
      );
      setIndexedEdit((prev) =>
        prev
          ? {
              ...prev,
              items: {
                ...prev.items,
                [itemKey]: { displayOrder: String(displayOrder), label, note },
              },
            }
          : prev
      );
      setItemExtraForms((prev) => ({
        ...prev,
        [itemKey]: makeItemExtraDefaults(),
      }));
      setItem((prev) => ({ ...prev, chainId: "1", contractAddress: "", tokenId: "", label: "", note: "" }));
      setTokenUri(null);
      const freshDetail = await readGalleryDirect(indexedDetail.gallery);
      applyIndexedDetail(freshDetail);
      void hydrateDirectMetadata(freshDetail);
      void loadIndexedDashboard(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item on-chain");
    } finally {
      setIsSavingIndexed(false);
    }
  }

  async function removeIndexedItem(itemKey: string) {
    if (!indexedDetail) return;
    setIsSavingIndexed(true);
    setError(null);
    try {
      const signer = await getSigner();
      const contract = new Contract(indexedDetail.gallery.collectionAddress, GALLERY_NFT_ABI, signer);
      await (await contract.removeItem(BigInt(indexedDetail.gallery.galleryId), itemKey)).wait();
      setIndexedDetail((prev) =>
        prev
          ? {
              gallery: { ...prev.gallery, itemCount: Math.max(0, prev.gallery.itemCount - 1) },
              items: prev.items.filter((item) => item.itemKey !== itemKey),
            }
          : prev
      );
      setIndexedEdit((prev) => {
        if (!prev) return prev;
        const { [itemKey]: _removed, ...items } = prev.items;
        return { ...prev, items };
      });
      setItemExtraForms((prev) => {
        const { [itemKey]: _removed, ...items } = prev;
        return items;
      });
      setTokenUri(null);
      await loadIndexedDashboard(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove item on-chain");
    } finally {
      setIsSavingIndexed(false);
    }
  }

  async function refreshIndexedMetadata() {
    if (!selectedIndexed) return;
    setIsRefreshingMetadata(true);
    try {
      const response = await fetch(
        `/api/indexed/galleries/${selectedIndexed.collectionAddress}/${selectedIndexed.galleryId}/metadata`,
        { method: "POST" }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Metadata refresh failed");
      }
      await reloadIndexedDetail();
      await loadIndexedDashboard(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Metadata refresh failed");
    } finally {
      setIsRefreshingMetadata(false);
    }
  }

  async function refreshSelectedFromContract() {
    if (!indexedDetail) return;
    setError(null);
    try {
      const detail = await readGalleryDirect(indexedDetail.gallery);
      applyIndexedDetail(detail);
      void hydrateDirectMetadata(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh gallery from contract");
    }
  }

  async function getSigner() {
    if (!window.ethereum) {
      throw new Error("No EVM wallet found.");
    }
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== GALLERY_NFT_CHAIN_ID) {
      throw new Error(`Switch wallet to chain ${GALLERY_NFT_CHAIN_ID}.`);
    }
    const signer = await provider.getSigner();
    setWallet(await signer.getAddress());
    return signer;
  }

  async function connectWallet() {
    setError(null);
    try {
      const signer = await getSigner();
      loadIndexedDashboard(await signer.getAddress());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
    }
  }

  function selectDraft(draft: DraftGallery, nextView: AppView = view) {
    setSelectedId(draft.id);
    setSelectedIndexed(null);
    setIndexedDetail(null);
    setSelectedCollection(draft.collectionAddress || selectedCollection);
    setView(nextView);
  }

  function createDraft() {
    const draft: DraftGallery = {
      id: makeId(),
      title: title.trim() || "Untitled Gallery",
      description: description.trim(),
      collectionAddress: selectedCollection || undefined,
      items: [],
    };
    setDrafts((prev) => [draft, ...prev]);
    setSelectedId(draft.id);
    setView("create");
  }

  function updateSelected(fields: Partial<DraftGallery>) {
    if (!selected) return;
    setDrafts((prev) =>
      prev.map((draft) => (draft.id === selected.id ? { ...draft, ...fields } : draft))
    );
  }

  function addCollection(collection: Collection) {
    const next = dedupeCollections([collection, ...collections]);
    setCollections(next);
    setSelectedCollection(collection.address);
    if (selected) updateSelected({ collectionAddress: collection.address });
  }

  async function readCollectionMetadata(address: string, signerOrProvider: any): Promise<Collection> {
    const contract = new Contract(address, GALLERY_NFT_ABI, signerOrProvider);
    try {
      const [name, symbol] = await Promise.all([contract.name(), contract.symbol()]);
      let version: string | null = null;
      try {
        version = String(await contract.contractVersion());
      } catch (_err) {
        version = null;
      }
      return { address, name, symbol, source: "factory", version };
    } catch (_err) {
      return { address, name: "GalleryNFT", symbol: "GALLERY", source: "factory", version: null };
    }
  }

  async function refreshFactoryCollections() {
    setError(null);
    setIsRefreshingCollections(true);
    try {
      if (!factoryMode) throw new Error("Set NEXT_PUBLIC_GALLERYNFT_FACTORY_ADDRESS first.");
      const signer = await getSigner();
      const address = await signer.getAddress();
      const factory = new Contract(GALLERY_NFT_FACTORY_ADDRESS, GALLERY_NFT_FACTORY_ABI, signer);
      const addresses = (await factory.getCollectionsByCreator(address)) as string[];
      const fromChain = await Promise.all(
        addresses.map(async (collectionAddress) => readCollectionMetadata(collectionAddress, signer))
      );
      setCollections((prev) => dedupeCollections([...fromChain, ...prev]));
      if (!selectedCollection && fromChain[0]) setSelectedCollection(fromChain[0].address);
      await loadIndexedDashboard(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh collections");
    } finally {
      setIsRefreshingCollections(false);
    }
  }

  function addManualCollection() {
    setError(null);
    if (!isAddressLike(manualCollection)) {
      setError("Enter a valid GalleryNFT contract address.");
      return;
    }
    addCollection({
      address: manualCollection,
      name: "Manual GalleryNFT",
      symbol: "GALLERY",
      source: "manual",
      version: null,
    });
    setManualCollection("");
  }

  async function deployCollection() {
    setError(null);
    setIsDeployingCollection(true);
    try {
      if (!factoryMode) throw new Error("Set NEXT_PUBLIC_GALLERYNFT_FACTORY_ADDRESS first.");
      const signer = await getSigner();
      const factory = new Contract(
        GALLERY_NFT_FACTORY_ADDRESS,
        GALLERY_NFT_FACTORY_ABI,
        signer
      );
      const tx = await factory.createCollection(
        collectionName.trim() || "On-Chain Galleries",
        collectionSymbol.trim() || "GALLERY"
      );
      const receipt = await tx.wait();
      const created = receipt.logs
        .map((log: any) => {
          try {
            return factory.interface.parseLog(log);
          } catch (_err) {
            return null;
          }
        })
        .find((log: any) => log?.name === "CollectionCreated");

      if (!created) throw new Error("CollectionCreated event not found");
      const createdAddress = String(created.args.collection);
      const metadata = await readCollectionMetadata(createdAddress, signer);
      addCollection({
        ...metadata,
        name: String(created.args.name),
        symbol: String(created.args.symbol),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Collection deployment failed");
    } finally {
      setIsDeployingCollection(false);
    }
  }

  function addItem() {
    setError(null);
    if (!selected) return;
    try {
      const packedRef =
        item.kind === "tezos"
          ? encodeTezosPackedRef(item.contractAddress, item.tokenId)
          : encodeEvmPackedRef(item.chainId, item.contractAddress, item.tokenId);
      const key = itemKeyFromPackedRef(packedRef);
      const next: DraftItem = {
        id: key,
        kind: item.kind,
        chainId: item.chainId,
        contractAddress: item.contractAddress.trim(),
        tokenId: item.tokenId.trim(),
        label: item.label.trim() || `Token #${item.tokenId}`,
        note: item.note.trim(),
      };
      updateSelected({ items: [...selected.items, next] });
      setItem((prev) => ({ ...prev, chainId: "1", contractAddress: "", tokenId: "", label: "", note: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    }
  }

  function autofill() {
    const parsed = parseItemUrl(pasteUrl);
    if (!parsed) {
      setError("Could not parse OpenSea or objkt item URL.");
      return;
    }
    setError(null);
    setItem((prev) => ({ ...prev, ...parsed }));
  }

  async function mintSelected() {
    if (!selected || isMinting) return;
    setError(null);
    setIsMinting(true);
    try {
      if (selected.mintedGalleryId && selected.collectionAddress) {
        throw new Error(
          `This draft already minted gallery #${selected.mintedGalleryId}. Select it from the dashboard instead of minting again.`
        );
      }
      const collectionAddress = selected.collectionAddress || selectedCollection;
      if (!isAddressLike(collectionAddress)) {
        throw new Error("Select or deploy a GalleryNFT collection first.");
      }

      const signer = await getSigner();
      const contract = new Contract(collectionAddress, GALLERY_NFT_ABI, signer);
      const createTx = await contract.createGallery(selected.title, selected.description);
      const receipt = await createTx.wait();
      const created = receipt.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch (_err) {
            return null;
          }
        })
        .find((log: any) => log?.name === "GalleryCreated");

      if (!created) throw new Error("GalleryCreated event not found");
      const galleryId = Number(created.args.galleryId);
      const owner = await signer.getAddress();
      const optimisticItems: IndexedGalleryItem[] = [];
      updateSelected({
        collectionAddress,
        mintedGalleryId: galleryId,
        txHash: createTx.hash,
      });

      for (let i = 0; i < selected.items.length; i += 1) {
        const draftItem = selected.items[i];
        const packedRef =
          draftItem.kind === "tezos"
            ? encodeTezosPackedRef(draftItem.contractAddress, draftItem.tokenId)
            : encodeEvmPackedRef(draftItem.chainId, draftItem.contractAddress, draftItem.tokenId);
        const itemKey = itemKeyFromPackedRef(packedRef);
        const tx = await contract.addItem(
          BigInt(galleryId),
          packedRef,
          i + 1,
          draftItem.label,
          draftItem.note
        );
        await tx.wait();
        optimisticItems.push({
          itemKey,
          packedRefHex: packedRef,
          displayOrder: i + 1,
          label: draftItem.label,
          note: draftItem.note,
        });
      }

      const optimisticGallery: IndexedGallery = {
        collectionAddress,
        galleryId,
        owner,
        title: selected.title,
        description: selected.description,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
        itemCount: optimisticItems.length,
        txHash: createTx.hash,
        syncStatus: "pending",
      };
      const optimisticDetail: IndexedDetail = {
        gallery: optimisticGallery,
        items: optimisticItems,
      };

      setDrafts((prev) => prev.filter((draft) => draft.id !== selected.id));
      setSelectedId(null);
      setSelectedIndexed({ collectionAddress, galleryId });
      setIndexedDetail(optimisticDetail);
      setIndexedEdit({
        title: selected.title,
        description: selected.description,
        items: Object.fromEntries(
          optimisticItems.map((item) => [
            item.itemKey,
            {
              displayOrder: String(item.displayOrder ?? 0),
              label: item.label || "",
              note: item.note || "",
            },
          ])
        ),
      });
      setIndexedGalleries((prev) => {
        const withoutDuplicate = prev.filter(
          (gallery) =>
            !(
              gallery.collectionAddress.toLowerCase() === collectionAddress.toLowerCase() &&
              gallery.galleryId === galleryId
            )
        );
        return [optimisticGallery, ...withoutDuplicate];
      });
      void loadIndexedDashboard(owner);
      setView("dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mint failed");
    } finally {
      setIsMinting(false);
    }
  }

  const selectedCollectionMeta = collections.find(
    (collection) => collection.address === selectedCollection
  );
  const hasCollection = collections.length > 0;
  const collectionLabel = (address: string) => {
    const collection = collections.find(
      (candidate) => candidate.address.toLowerCase() === address.toLowerCase()
    );
    return collection
      ? `${collection.name} (${collection.symbol})`
      : shortAddress(address);
  };
  const selectedContractFeatures = indexedDetail
    ? contractFeatures[indexedDetail.gallery.collectionAddress.toLowerCase()]
    : null;

  function hideGalleryLocally(gallery: IndexedGallery) {
    const key = galleryStorageKey(gallery.collectionAddress, gallery.galleryId);
    setHiddenGalleryKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    if (
      selectedIndexed?.collectionAddress.toLowerCase() === gallery.collectionAddress.toLowerCase() &&
      selectedIndexed.galleryId === gallery.galleryId
    ) {
      setSelectedIndexed(null);
      setIndexedDetail(null);
      setIndexedEdit(null);
    }
  }

  return (
    <main style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>On-Chain Gallery</h1>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Dashboard, local drafts, and wallet-owned GalleryNFT collections.
          </div>
        </div>
        <button type="button" onClick={connectWallet} style={buttonStyle}>
          {wallet ? shortAddress(wallet) : "Connect wallet"}
        </button>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setView("dashboard")}
          style={{ ...buttonStyle, background: view === "dashboard" ? "var(--panel-2)" : "var(--panel)" }}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => setView("create")}
          style={{ ...buttonStyle, background: view === "create" ? "var(--panel-2)" : "var(--panel)" }}
        >
          Create / edit
        </button>
      </div>

      {!walletMode ? (
        <div style={{ color: "#b00020" }}>
          Set `NEXT_PUBLIC_GALLERYNFT_FACTORY_ADDRESS` to deploy collections, or
          `NEXT_PUBLIC_GALLERYNFT_ADDRESS` to mint into one configured collection.
        </div>
      ) : null}
      {error ? <div style={{ color: "#b00020" }}>{error}</div> : null}
      {hiddenGalleryKeys.length > 0 ? (
        <div style={{ ...panelStyle, display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            {hiddenGalleryKeys.length} gallery token(s) hidden locally in this browser.
          </span>
          <button
            type="button"
            onClick={() => setHiddenGalleryKeys([])}
            style={{ ...buttonStyle, padding: "4px 7px", fontSize: "12px" }}
          >
            Show hidden again
          </button>
        </div>
      ) : null}

      {fullPreviewItem ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0, 0, 0, 0.82)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "min(1100px, 96vw)",
              height: "min(820px, 90vh)",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "12px",
              display: "grid",
              gridTemplateRows: "auto 1fr",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {fullPreviewItem.name || fullPreviewItem.label || "Artwork preview"}
                </div>
                {fullPreviewItem.artist ? (
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>{fullPreviewItem.artist}</div>
                ) : null}
              </div>
              <button type="button" onClick={() => setFullPreviewItem(null)} style={buttonStyle}>
                Close
              </button>
            </div>
            <div
              style={{
                minHeight: 0,
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background: "var(--panel-2)",
                overflow: "hidden",
                minWidth: 0,
              }}
            >
              <MediaPreview item={fullPreviewItem} />
            </div>
          </div>
        </div>
      ) : null}

      {view === "dashboard" ? (
        <section style={{ display: "grid", gap: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
            <div style={panelStyle}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>Collections</div>
              <div style={{ fontSize: "28px", fontWeight: 700 }}>{collections.length}</div>
            </div>
            <div style={panelStyle}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>Local galleries</div>
              <div style={{ fontSize: "28px", fontWeight: 700 }}>{drafts.length}</div>
            </div>
            <div style={panelStyle}>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>Indexed galleries</div>
              <div style={{ fontSize: "28px", fontWeight: 700 }}>{indexedGalleries.length}</div>
            </div>
          </div>

          <section style={{ ...panelStyle, display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700 }}>My collection contracts</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => loadIndexedDashboard(wallet)}
                    disabled={isLoadingIndexed}
                    style={buttonStyle}
                  >
                    {isLoadingIndexed ? "Loading..." : "Refresh indexed"}
                  </button>
                  <button
                    type="button"
                    onClick={refreshFactoryCollections}
                    disabled={!factoryMode || isRefreshingCollections}
                    style={buttonStyle}
                  >
                    {isRefreshingCollections ? "Refreshing..." : "Refresh from factory"}
                  </button>
                </div>
              </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
              {collections.map((collection) => (
                <button
                  key={collection.address}
                  type="button"
                  onClick={() => setSelectedCollection(collection.address)}
                  style={{
                    ...buttonStyle,
                    textAlign: "left",
                    padding: "12px",
                    background:
                      collection.address === selectedCollection ? "var(--panel-2)" : "var(--panel)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{collection.name}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {collection.symbol} | {sourceLabel(collection.source)}
                    {collection.version ? ` | GalleryNFT v${collection.version}` : " | version unknown"}
                  </div>
                  <div title={collection.address} style={{ fontSize: "12px", marginTop: "6px" }}>
                    {shortAddress(collection.address)}
                  </div>
                </button>
              ))}
              {collections.length === 0 ? (
                <div style={{ color: "var(--muted)" }}>
                  No known collection contracts yet. Deploy or import one from Create / edit.
                </div>
              ) : null}
            </div>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "minmax(220px, 360px) 1fr", gap: "16px" }}>
            <div style={{ ...panelStyle, display: "grid", gap: "8px", alignContent: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <div style={{ fontWeight: 700 }}>Galleries</div>
                <button type="button" onClick={() => setView("create")} style={buttonStyle}>
                  New gallery
                </button>
              </div>
              {filteredIndexedGalleries.map((gallery) => (
                <div
                  key={`${gallery.collectionAddress}:${gallery.galleryId}`}
                  style={{
                    ...buttonStyle,
                    textAlign: "left",
                    padding: "10px",
                    cursor: "default",
                    background:
                      selectedIndexed?.collectionAddress.toLowerCase() ===
                        gallery.collectionAddress.toLowerCase() &&
                      selectedIndexed?.galleryId === gallery.galleryId
                        ? "var(--panel-2)"
                        : "var(--panel)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{gallery.title || `Gallery #${gallery.galleryId}`}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {gallery.itemCount} item(s) | #{gallery.galleryId}
                    {gallery.syncStatus === "pending" ? " | waiting for indexer" : " | indexed"}
                  </div>
                  <div title={gallery.collectionAddress} style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {collectionLabel(gallery.collectionAddress)} | {shortAddress(gallery.collectionAddress)}
                  </div>
                  {gallery.syncStatus === "pending" ? (
                    <div style={{ marginTop: "6px", fontSize: "12px", color: "#a06400" }}>
                      Confirmed on-chain. Waiting for the indexer cache to catch up.
                    </div>
                  ) : null}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => selectIndexedGallery(gallery)}
                      style={{ ...buttonStyle, padding: "4px 7px", fontSize: "12px" }}
                    >
                      Open
                    </button>
                    {txUrl(gallery.txHash) ? (
                      <a
                        href={txUrl(gallery.txHash)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...buttonStyle, padding: "4px 7px", fontSize: "12px", textDecoration: "none" }}
                      >
                        Tx
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => hideGalleryLocally(gallery)}
                      style={{ ...buttonStyle, padding: "4px 7px", fontSize: "12px" }}
                      title="Hide this gallery from this browser only. This does not delete the ERC-721 token."
                    >
                      Hide locally
                    </button>
                  </div>
                </div>
              ))}
              {filteredIndexedGalleries.length === 0 ? (
                <div style={{ color: "var(--muted)" }}>
                  No indexed galleries yet. If you have just minted, run the indexer and click Refresh indexed.
                </div>
              ) : null}
            </div>

            <div style={{ ...panelStyle, display: "grid", gap: "12px", alignContent: "start" }}>
              {indexedDetail ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>Indexed gallery viewer</div>
                      <h2 style={{ margin: "2px 0" }}>
                        {indexedDetail.gallery.title || `Gallery #${indexedDetail.gallery.galleryId}`}
                      </h2>
                      <div style={{ color: "var(--muted)" }}>
                        {indexedDetail.gallery.description || "No description."}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignContent: "start" }}>
                      <button
                        type="button"
                        onClick={loadTokenUri}
                        disabled={isLoadingTokenUri}
                        style={buttonStyle}
                      >
                        {isLoadingTokenUri ? "Loading..." : tokenUri ? "Hide tokenURI" : "Show tokenURI"}
                      </button>
                      <button
                        type="button"
                        onClick={refreshIndexedMetadata}
                        disabled={isRefreshingMetadata}
                        style={buttonStyle}
                      >
                        {isRefreshingMetadata ? "Refreshing..." : "Refresh metadata"}
                      </button>
                      <button
                        type="button"
                        onClick={refreshSelectedFromContract}
                        style={buttonStyle}
                      >
                        Refresh from contract
                      </button>
                      <button
                        type="button"
                        onClick={notifyMarketplaces}
                        disabled={isNotifyingMarketplaces}
                        style={buttonStyle}
                        title="Emit ERC-4906 MetadataUpdate for this gallery token."
                      >
                        {isNotifyingMarketplaces ? "Notifying..." : "Ask marketplaces to refresh"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView("create")}
                        style={buttonStyle}
                      >
                        Open in editor
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Gallery #{indexedDetail.gallery.galleryId} | {shortAddress(indexedDetail.gallery.collectionAddress)}
                    {indexedDetail.gallery.syncStatus === "pending"
                      ? " | confirmed on-chain, waiting for indexer"
                      : " | indexed cache"}
                  </div>
                  {txUrl(indexedDetail.gallery.txHash) ? (
                    <a
                      href={txUrl(indexedDetail.gallery.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "12px" }}
                    >
                      View mint transaction
                    </a>
                  ) : null}
                  {tokenUri ? (
                    <details
                      open
                      style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "10px" }}
                    >
                      <summary>tokenURI output</summary>
                      {tokenUri.metadata ? (
                        <>
                          <TokenUriImagePreview metadata={tokenUri.metadata} />
                          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "12px" }}>
                            {JSON.stringify(tokenUri.metadata, null, 2)}
                          </pre>
                        </>
                      ) : (
                        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "12px" }}>
                          {tokenUri.raw}
                        </pre>
                      )}
                    </details>
                  ) : null}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(150px, 180px))",
                      justifyContent: "start",
                      gap: "10px",
                    }}
                  >
                    {indexedDetail.items.map((item) => (
                      <div key={item.itemKey} style={{ display: "grid", gap: "6px" }}>
                        <div
                          style={{
                            height: "82px",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            display: "grid",
                            placeItems: "center",
                            background: "var(--panel-2)",
                            textAlign: "center",
                            padding: "8px",
                            overflow: "hidden",
                            minWidth: 0,
                            minHeight: 0,
                          }}
                        >
                          <MediaPreview item={item} />
                        </div>
                        <div title={item.itemKey} style={{ fontSize: "12px", color: "var(--muted)" }}>
                          <div>{item.name || item.label || "Untitled item"}</div>
                          {item.artist ? <div>{item.artist}</div> : null}
                          {shortAddress(item.itemKey)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setFullPreviewItem(item)}
                          style={{ ...buttonStyle, padding: "4px 7px", fontSize: "12px", width: "fit-content" }}
                        >
                          Full preview
                        </button>
                      </div>
                    ))}
                    {indexedDetail.items.length === 0 ? (
                      <div style={{ color: "var(--muted)" }}>No indexed active items.</div>
                    ) : null}
                  </div>
                </>
              ) : selected ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>Gallery viewer</div>
                      <h2 style={{ margin: "2px 0" }}>{selected.title}</h2>
                      <div style={{ color: "var(--muted)" }}>{selected.description || "No description yet."}</div>
                    </div>
                    <button type="button" onClick={() => setView("create")} style={buttonStyle}>
                      Edit
                    </button>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {selected.mintedGalleryId
                      ? `Minted gallery #${selected.mintedGalleryId}`
                      : "Local draft, not minted yet"}
                    {selected.collectionAddress ? ` | ${shortAddress(selected.collectionAddress)}` : ""}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" }}>
                    {selected.items.map((draftItem) => (
                      <div key={draftItem.id} style={{ display: "grid", gap: "6px" }}>
                        <div
                          style={{
                            aspectRatio: "1 / 1",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            display: "grid",
                            placeItems: "center",
                            background: "var(--panel-2)",
                            textAlign: "center",
                            padding: "8px",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{draftItem.label}</div>
                            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                              #{draftItem.tokenId}
                            </div>
                          </div>
                        </div>
                        <div title={draftItem.contractAddress} style={{ fontSize: "12px", color: "var(--muted)" }}>
                          {draftItem.kind === "tezos" ? "Tezos" : `EVM chain ${draftItem.chainId}`} |{" "}
                          {shortAddress(draftItem.contractAddress)}
                        </div>
                      </div>
                    ))}
                    {selected.items.length === 0 ? (
                      <div style={{ color: "var(--muted)" }}>No items in this gallery yet.</div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--muted)" }}>Select a gallery to preview it here.</div>
              )}
            </div>
          </section>
        </section>
      ) : (
        <section style={{ display: "grid", gap: "16px" }}>
          <section style={{ ...panelStyle, display: "grid", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Active collection</div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Choose the ERC-721 collection contract that will hold or edit gallery tokens.
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => loadIndexedDashboard(wallet)}
                  disabled={isLoadingIndexed}
                  style={buttonStyle}
                >
                  {isLoadingIndexed ? "Loading..." : "Refresh indexed"}
                </button>
                <button
                  type="button"
                  onClick={refreshFactoryCollections}
                  disabled={!factoryMode || isRefreshingCollections}
                  style={buttonStyle}
                >
                  {isRefreshingCollections ? "Refreshing..." : "Refresh from factory"}
                </button>
              </div>
            </div>
            <FieldLabel label="Collection contract">
              <select
                value={selectedCollection}
                onChange={(event) => {
                  setSelectedCollection(event.target.value);
                  if (selected) updateSelected({ collectionAddress: event.target.value });
                }}
                style={inputStyle}
              >
                <option value="">Select collection contract</option>
                {collections.map((collection) => (
                  <option key={collection.address} value={collection.address}>
                    {collection.name} ({collection.symbol})
                    {collection.version ? ` v${collection.version}` : ""}
                    {" - "}
                    {shortAddress(collection.address)}
                  </option>
                ))}
              </select>
            </FieldLabel>
            {selectedCollectionMeta ? (
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Selected: {selectedCollectionMeta.name} at {shortAddress(selectedCollectionMeta.address)}
                {selectedCollectionMeta.version
                  ? ` | GalleryNFT v${selectedCollectionMeta.version}`
                  : " | version unknown until refreshed from chain"}
              </div>
            ) : null}
          </section>

          {hasCollection ? (
            <details style={{ ...panelStyle, display: "grid", gap: "8px" }}>
              <summary style={{ fontWeight: 700, cursor: "pointer" }}>Create new gallery draft</summary>
              <div style={{ height: "8px" }} />
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Creates an editable draft first, then you mint it on-chain when ready.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(240px, 2fr)", gap: "8px" }}>
                <FieldLabel label="Gallery title">
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Gallery title"
                    style={inputStyle}
                  />
                </FieldLabel>
                <FieldLabel label="Gallery description">
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Gallery description"
                    rows={2}
                    style={inputStyle}
                  />
                </FieldLabel>
              </div>
              <button type="button" onClick={createDraft} style={{ ...buttonStyle, width: "fit-content" }}>
                Create gallery draft
              </button>
            </details>
          ) : (
            <section style={{ ...panelStyle, display: "grid", gap: "10px", maxWidth: "760px" }}>
              <div>
                <div style={{ fontWeight: 700 }}>First create your collection contract</div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  A collection contract is the ERC-721 contract that will mint and own your gallery tokens.
                </div>
                <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                  Factory: {shortAddress(GALLERY_NFT_FACTORY_ADDRESS)}
                  {GALLERY_NFT_FACTORY_VERSION
                    ? ` | creates GalleryNFT v${GALLERY_NFT_FACTORY_VERSION}`
                    : " | collection version is checked after deployment"}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
                <FieldLabel label="Collection name">
                  <input
                    value={collectionName}
                    onChange={(event) => setCollectionName(event.target.value)}
                    placeholder="Collection name"
                    style={inputStyle}
                  />
                </FieldLabel>
                <FieldLabel label="Collection symbol">
                  <input
                    value={collectionSymbol}
                    onChange={(event) => setCollectionSymbol(event.target.value.toUpperCase())}
                    placeholder="Symbol"
                    style={inputStyle}
                  />
                </FieldLabel>
                <button
                  type="button"
                  onClick={deployCollection}
                  disabled={!factoryMode || isDeployingCollection}
                  style={{ ...buttonStyle, alignSelf: "end" }}
                >
                  {isDeployingCollection ? "Deploying..." : "Deploy collection"}
                </button>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <FieldLabel label="Or add an existing GalleryNFT contract">
                  <input
                    value={manualCollection}
                    onChange={(event) => setManualCollection(event.target.value)}
                    placeholder={item.kind === "tezos" ? "KT1..." : "0x..."}
                    style={{ ...inputStyle, minWidth: "280px" }}
                  />
                </FieldLabel>
                <button type="button" onClick={addManualCollection} style={{ ...buttonStyle, alignSelf: "end" }}>
                  Add existing
                </button>
              </div>
            </section>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 320px) 1fr", gap: "16px" }}>
            <aside style={{ display: "grid", gap: "8px", alignContent: "start" }}>
              <div>
                <div style={{ fontWeight: 700 }}>Galleries in active collection</div>
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  Select a gallery token to edit its on-chain fields and NFT list.
                </div>
              </div>
              {filteredIndexedGalleries.map((gallery) => (
                <div
                  key={`${gallery.collectionAddress}:${gallery.galleryId}:edit`}
                  style={{
                    ...buttonStyle,
                    textAlign: "left",
                    padding: "10px",
                    cursor: "default",
                    background:
                      selectedIndexed?.collectionAddress.toLowerCase() ===
                        gallery.collectionAddress.toLowerCase() &&
                      selectedIndexed?.galleryId === gallery.galleryId
                        ? "var(--panel-2)"
                        : "var(--panel)",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{gallery.title || `Gallery #${gallery.galleryId}`}</div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    #{gallery.galleryId} | {gallery.itemCount} item(s)
                    {gallery.syncStatus === "pending" ? " | waiting for indexer" : ""}
                  </div>
                  <div title={gallery.collectionAddress} style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {collectionLabel(gallery.collectionAddress)} | {shortAddress(gallery.collectionAddress)}
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        void selectIndexedGallery(gallery);
                        setView("create");
                      }}
                      style={{ ...buttonStyle, padding: "4px 7px", fontSize: "12px" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => hideGalleryLocally(gallery)}
                      style={{ ...buttonStyle, padding: "4px 7px", fontSize: "12px" }}
                      title="Hide this gallery from this browser only. This does not delete the ERC-721 token."
                    >
                      Hide locally
                    </button>
                  </div>
                </div>
              ))}
              {filteredIndexedGalleries.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  No indexed galleries for this collection yet.
                </div>
              ) : null}

              {drafts.length > 0 ? (
                <details style={{ marginTop: "8px" }}>
                  <summary style={{ fontWeight: 700, cursor: "pointer" }}>
                    Local drafts ({drafts.length})
                  </summary>
                  <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                    {drafts.map((draft) => (
                      <button
                        key={draft.id}
                        type="button"
                        onClick={() => selectDraft(draft, "create")}
                        style={{
                          ...buttonStyle,
                          textAlign: "left",
                          padding: "10px",
                          background: draft.id === selectedId ? "var(--panel-2)" : "var(--panel)",
                        }}
                      >
                        <div>{draft.title}</div>
                        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                          {draft.items.length} item(s)
                          {draft.mintedGalleryId ? ` | minted #${draft.mintedGalleryId}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                </details>
              ) : null}
            </aside>

            {indexedDetail && indexedEdit ? (
            <section style={{ ...panelStyle, display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>On-chain gallery editor</div>
                  <h2 style={{ margin: "2px 0" }}>
                    {indexedDetail.gallery.title || `Gallery #${indexedDetail.gallery.galleryId}`}
                  </h2>
                  <div title={indexedDetail.gallery.collectionAddress} style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Gallery #{indexedDetail.gallery.galleryId} in{" "}
                    {shortAddress(indexedDetail.gallery.collectionAddress)}
                    {indexedDetail.gallery.syncStatus === "pending"
                      ? " | confirmed on-chain, waiting for indexer"
                      : ""}
                  </div>
                  {txUrl(indexedDetail.gallery.txHash) ? (
                    <a
                      href={txUrl(indexedDetail.gallery.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "12px" }}
                    >
                      View mint transaction
                    </a>
                  ) : null}
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Protocol{" "}
                    {selectedContractFeatures?.version
                      ? `v${selectedContractFeatures.version}`
                      : "version unknown"}
                    {selectedContractFeatures?.hasExtraData ? " | extra-data supported" : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignSelf: "start" }}>
                  <button
                    type="button"
                    onClick={saveIndexedEdits}
                    disabled={isSavingIndexed}
                    style={{
                      ...buttonStyle,
                      background: "var(--text)",
                      color: "var(--bg)",
                      width: "fit-content",
                    }}
                  >
                    {isSavingIndexed ? "Waiting for wallet..." : "Save gallery changes"}
                  </button>
                  <button
                    type="button"
                    onClick={notifyMarketplaces}
                    disabled={isNotifyingMarketplaces}
                    style={{ ...buttonStyle, width: "fit-content" }}
                    title="Emit ERC-4906 MetadataUpdate for this gallery token."
                  >
                    {isNotifyingMarketplaces ? "Notifying..." : "Ask marketplaces to refresh"}
                  </button>
                  <button
                    type="button"
                    onClick={refreshSelectedFromContract}
                    style={{ ...buttonStyle, width: "fit-content" }}
                  >
                    Refresh from contract
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gap: "8px", maxWidth: "760px" }}>
                <FieldLabel label="Gallery title">
                  <input
                    value={indexedEdit.title}
                    onChange={(event) =>
                      setIndexedEdit((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                    }
                    placeholder="Gallery title"
                    style={inputStyle}
                  />
                </FieldLabel>
                <FieldLabel label="Gallery description">
                  <textarea
                    value={indexedEdit.description}
                    onChange={(event) =>
                      setIndexedEdit((prev) =>
                        prev ? { ...prev, description: event.target.value } : prev
                      )
                    }
                    placeholder="Gallery description"
                    rows={3}
                    style={inputStyle}
                  />
                </FieldLabel>
              </div>

              <details
                style={{
                  display: "grid",
                  gap: "8px",
                  border: "1px solid var(--border)",
                  padding: "10px",
                  borderRadius: "8px",
                }}
              >
                <summary style={{ fontWeight: 700, cursor: "pointer" }}>
                  Add NFT to this gallery
                </summary>
                <div style={{ height: "4px" }} />
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <FieldLabel label="OpenSea or objkt item URL">
                    <input
                      value={pasteUrl}
                      onChange={(event) => setPasteUrl(event.target.value)}
                      placeholder="https://opensea.io/item/... or https://objkt.com/tokens/..."
                      style={{ ...inputStyle, minWidth: "320px" }}
                    />
                  </FieldLabel>
                  <button type="button" onClick={autofill} style={buttonStyle}>
                    Autofill
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
                  <FieldLabel label="NFT type">
                    <select
                      value={item.kind}
                      onChange={(event) =>
                        setItem((prev) => ({
                          ...prev,
                          kind: event.target.value as "evm" | "tezos",
                          chainId: event.target.value === "tezos" ? "tezos" : "1",
                        }))
                      }
                      style={inputStyle}
                    >
                      <option value="evm">EVM</option>
                      <option value="tezos">Tezos</option>
                    </select>
                  </FieldLabel>
                  {item.kind === "evm" ? (
                  <FieldLabel label="NFT chain ID">
                    <input
                      value={item.chainId}
                      onChange={(event) => setItem((prev) => ({ ...prev, chainId: event.target.value }))}
                      placeholder="1"
                      style={inputStyle}
                    />
                  </FieldLabel>
                  ) : null}
                  <FieldLabel label={item.kind === "tezos" ? "Tezos KT1 contract" : "NFT contract"}>
                    <input
                      value={item.contractAddress}
                      onChange={(event) =>
                        setItem((prev) => ({ ...prev, contractAddress: event.target.value }))
                      }
                      placeholder={item.kind === "tezos" ? "KT1..." : "0x..."}
                      style={inputStyle}
                    />
                  </FieldLabel>
                  <FieldLabel label="NFT token ID">
                    <input
                      value={item.tokenId}
                      onChange={(event) => setItem((prev) => ({ ...prev, tokenId: event.target.value }))}
                      placeholder="Token ID"
                      style={inputStyle}
                    />
                  </FieldLabel>
                </div>
                <FieldLabel label="Item label">
                  <input
                    value={item.label}
                    onChange={(event) => setItem((prev) => ({ ...prev, label: event.target.value }))}
                    placeholder="Label"
                    style={inputStyle}
                  />
                </FieldLabel>
                <FieldLabel label="Curator note">
                  <textarea
                    value={item.note}
                    onChange={(event) => setItem((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Curator note"
                    rows={2}
                    style={inputStyle}
                  />
                </FieldLabel>
                <button
                  type="button"
                  onClick={addIndexedItem}
                  disabled={isSavingIndexed}
                  style={{ ...buttonStyle, width: "fit-content" }}
                >
                  {isSavingIndexed ? "Waiting for wallet..." : "Add item on-chain"}
                </button>
              </details>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
                {indexedDetail.items.map((galleryItem) => (
                  <div
                    key={galleryItem.itemKey}
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "10px",
                      display: "grid",
                      gap: "8px",
                      minWidth: 0,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "96px",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        display: "grid",
                        placeItems: "center",
                        background: "var(--panel-2)",
                        overflow: "hidden",
                        minWidth: 0,
                        minHeight: 0,
                      }}
                    >
                      <MediaPreview item={galleryItem} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setFullPreviewItem(galleryItem)}
                      style={{ ...buttonStyle, padding: "4px 7px", fontSize: "12px", width: "fit-content" }}
                    >
                      Full preview
                    </button>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      <div title={galleryItem.itemKey}>{shortAddress(galleryItem.itemKey)}</div>
                      {galleryItem.artist ? <div>Artist: {galleryItem.artist}</div> : null}
                    </div>
                    {indexedEdit.items[galleryItem.itemKey] ? (
                      <>
                        <FieldLabel label="Display order">
                          <input
                            value={indexedEdit.items[galleryItem.itemKey].displayOrder}
                            onChange={(event) =>
                              updateIndexedItemEdit(galleryItem.itemKey, {
                                displayOrder: event.target.value,
                              })
                            }
                            placeholder="Order"
                            style={inputStyle}
                          />
                        </FieldLabel>
                        <FieldLabel label="Item label">
                          <input
                            value={indexedEdit.items[galleryItem.itemKey].label}
                            onChange={(event) =>
                              updateIndexedItemEdit(galleryItem.itemKey, { label: event.target.value })
                            }
                            placeholder="Label"
                            style={inputStyle}
                          />
                        </FieldLabel>
                        <FieldLabel label="Curator note">
                          <textarea
                            value={indexedEdit.items[galleryItem.itemKey].note}
                            onChange={(event) =>
                              updateIndexedItemEdit(galleryItem.itemKey, { note: event.target.value })
                            }
                            placeholder="Curator note"
                            rows={2}
                            style={inputStyle}
                          />
                        </FieldLabel>
                        <details style={{ borderTop: "1px solid var(--border)", paddingTop: "6px" }}>
                          <summary style={{ cursor: "pointer", color: "var(--muted)" }}>
                            v1.1 extra data
                          </summary>
                          <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
                            {selectedContractFeatures && !selectedContractFeatures.hasExtraData ? (
                              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                                This collection has not reported v1.1 extra-data support.
                              </div>
                            ) : null}
                            <FieldLabel label="Wall text / extended note">
                              <textarea
                                value={
                                  (itemExtraForms[galleryItem.itemKey] || makeItemExtraDefaults())
                                    .wallText
                                }
                                onChange={(event) =>
                                  updateItemExtraForm(galleryItem.itemKey, {
                                    wallText: event.target.value,
                                  })
                                }
                                rows={3}
                                style={inputStyle}
                              />
                            </FieldLabel>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                gap: "8px",
                              }}
                            >
                              <FieldLabel label="Frame fit">
                                <select
                                  value={
                                    (itemExtraForms[galleryItem.itemKey] || makeItemExtraDefaults())
                                      .displayFit
                                  }
                                  onChange={(event) =>
                                    updateItemExtraForm(galleryItem.itemKey, {
                                      displayFit: event.target.value,
                                    })
                                  }
                                  style={inputStyle}
                                >
                                  <option value="contain">Contain</option>
                                  <option value="cover">Cover</option>
                                  <option value="native">Native</option>
                                </select>
                              </FieldLabel>
                              <FieldLabel label="Preferred media">
                                <select
                                  value={
                                    (itemExtraForms[galleryItem.itemKey] || makeItemExtraDefaults())
                                      .preferredMedia
                                  }
                                  onChange={(event) =>
                                    updateItemExtraForm(galleryItem.itemKey, {
                                      preferredMedia: event.target.value,
                                    })
                                  }
                                  style={inputStyle}
                                >
                                  <option value="image">Image</option>
                                  <option value="animation">Animation</option>
                                  <option value="auto">Auto</option>
                                </select>
                              </FieldLabel>
                            </div>
                            <FieldLabel label="Frame background">
                              <input
                                value={
                                  (itemExtraForms[galleryItem.itemKey] || makeItemExtraDefaults())
                                    .displayBackground
                                }
                                onChange={(event) =>
                                  updateItemExtraForm(galleryItem.itemKey, {
                                    displayBackground: event.target.value,
                                  })
                                }
                                placeholder="#000000"
                                style={inputStyle}
                              />
                            </FieldLabel>
                            <button
                              type="button"
                              onClick={() => saveItemExtraData(galleryItem.itemKey)}
                              disabled={isSavingExtraData}
                              style={{ ...buttonStyle, width: "fit-content" }}
                            >
                              {isSavingExtraData ? "Saving..." : "Save extra data"}
                            </button>
                          </div>
                        </details>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => removeIndexedItem(galleryItem.itemKey)}
                      disabled={isSavingIndexed}
                      style={{ ...buttonStyle, width: "fit-content" }}
                    >
                      Remove item
                    </button>
                  </div>
                ))}
                {indexedDetail.items.length === 0 ? (
                  <div style={{ color: "var(--muted)" }}>No active items. Add one above.</div>
                ) : null}
              </div>
            </section>
            ) : selected ? (
              <section style={{ display: "grid", gap: "12px" }}>
                <div style={{ display: "grid", gap: "8px" }}>
                  <FieldLabel label="Draft gallery title">
                    <input
                      value={selected.title}
                      onChange={(event) => updateSelected({ title: event.target.value })}
                      style={inputStyle}
                    />
                  </FieldLabel>
                  <FieldLabel label="Draft gallery description">
                    <textarea
                      value={selected.description}
                      onChange={(event) => updateSelected({ description: event.target.value })}
                      rows={3}
                      style={inputStyle}
                    />
                  </FieldLabel>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    border: "1px solid var(--border)",
                    padding: "10px",
                    borderRadius: "8px",
                  }}
                >
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <FieldLabel label="OpenSea or objkt item URL">
                      <input
                        value={pasteUrl}
                        onChange={(event) => setPasteUrl(event.target.value)}
                        placeholder="https://opensea.io/item/... or https://objkt.com/tokens/..."
                        style={{ ...inputStyle, minWidth: "320px" }}
                      />
                    </FieldLabel>
                    <button type="button" onClick={autofill} style={buttonStyle}>
                      Autofill
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
                    <FieldLabel label="NFT type">
                      <select
                        value={item.kind}
                        onChange={(event) =>
                          setItem((prev) => ({
                            ...prev,
                            kind: event.target.value as "evm" | "tezos",
                            chainId: event.target.value === "tezos" ? "tezos" : "1",
                          }))
                        }
                        style={inputStyle}
                      >
                        <option value="evm">EVM</option>
                        <option value="tezos">Tezos</option>
                      </select>
                    </FieldLabel>
                    {item.kind === "evm" ? (
                      <FieldLabel label="NFT chain ID">
                        <input
                          value={item.chainId}
                          onChange={(event) => setItem((prev) => ({ ...prev, chainId: event.target.value }))}
                          placeholder="1"
                          style={inputStyle}
                        />
                      </FieldLabel>
                    ) : null}
                    <FieldLabel label={item.kind === "tezos" ? "Tezos KT1 contract" : "NFT contract"}>
                      <input
                        value={item.contractAddress}
                        onChange={(event) =>
                          setItem((prev) => ({ ...prev, contractAddress: event.target.value }))
                        }
                        placeholder={item.kind === "tezos" ? "KT1..." : "0x..."}
                        style={inputStyle}
                      />
                    </FieldLabel>
                    <FieldLabel label="NFT token ID">
                      <input
                        value={item.tokenId}
                        onChange={(event) => setItem((prev) => ({ ...prev, tokenId: event.target.value }))}
                        placeholder="Token ID"
                        style={inputStyle}
                      />
                    </FieldLabel>
                  </div>
                  <FieldLabel label="Item label">
                    <input
                      value={item.label}
                      onChange={(event) => setItem((prev) => ({ ...prev, label: event.target.value }))}
                      placeholder="Label"
                      style={inputStyle}
                    />
                  </FieldLabel>
                  <FieldLabel label="Curator note">
                    <textarea
                      value={item.note}
                      onChange={(event) => setItem((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder="Curator note"
                      rows={2}
                      style={inputStyle}
                    />
                  </FieldLabel>
                  <button type="button" onClick={addItem} style={{ ...buttonStyle, width: "fit-content" }}>
                    Add to draft
                  </button>
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  {selected.items.map((draftItem, index) => (
                    <div
                      key={draftItem.id}
                      style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "10px" }}
                    >
                      <div>
                        {index + 1}. {draftItem.label}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        {draftItem.kind === "tezos" ? "Tezos" : `EVM chain ${draftItem.chainId}`}{" "}
                        {shortAddress(draftItem.contractAddress)} #
                        {draftItem.tokenId}
                      </div>
                      {draftItem.note ? <div>{draftItem.note}</div> : null}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={mintSelected}
                  disabled={!walletMode || isMinting || Boolean(selected.mintedGalleryId)}
                  style={{
                    ...buttonStyle,
                    width: "fit-content",
                    padding: "10px 14px",
                    background: walletMode ? "var(--text)" : "var(--panel-2)",
                    color: walletMode ? "var(--bg)" : "var(--muted)",
                  }}
                >
                  {selected.mintedGalleryId
                    ? "Already minted"
                    : isMinting
                      ? "Minting..."
                      : "Mint gallery on-chain"}
                </button>
                {selected.mintedGalleryId ? (
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Minted gallery #{selected.mintedGalleryId} in {shortAddress(selected.collectionAddress || "")}:{" "}
                    {selected.txHash}
                  </div>
                ) : null}
              </section>
            ) : (
              <section>Select or create a local draft.</section>
            )}
          </div>

          {hasCollection ? (
          <details style={{ ...panelStyle, display: "grid", gap: "10px" }}>
            <summary style={{ fontWeight: 700, cursor: "pointer" }}>
              Advanced: collection contracts
              {selectedCollectionMeta ? (
                <span style={{ fontWeight: 400, color: "var(--muted)" }}>
                  {" "}— {selectedCollectionMeta.name} {shortAddress(selectedCollectionMeta.address)}
                </span>
              ) : null}
            </summary>
            <div style={{ height: "10px" }} />
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              Factory: {shortAddress(GALLERY_NFT_FACTORY_ADDRESS)}
              {GALLERY_NFT_FACTORY_VERSION
                ? ` | creates GalleryNFT v${GALLERY_NFT_FACTORY_VERSION}`
                : " | collection version is checked after deployment"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px" }}>
              <FieldLabel label="Collection name">
                <input
                  value={collectionName}
                  onChange={(event) => setCollectionName(event.target.value)}
                  placeholder="Collection name"
                  style={inputStyle}
                />
              </FieldLabel>
              <FieldLabel label="Collection symbol">
                <input
                  value={collectionSymbol}
                  onChange={(event) => setCollectionSymbol(event.target.value.toUpperCase())}
                  placeholder="Symbol"
                  style={inputStyle}
                />
              </FieldLabel>
              <button
                type="button"
                onClick={deployCollection}
                disabled={!factoryMode || isDeployingCollection}
                style={buttonStyle}
              >
                {isDeployingCollection ? "Deploying..." : "Deploy collection"}
              </button>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <FieldLabel label="Existing GalleryNFT contract">
                <input
                  value={manualCollection}
                  onChange={(event) => setManualCollection(event.target.value)}
                  placeholder="0x..."
                  style={{ ...inputStyle, minWidth: "280px" }}
                />
              </FieldLabel>
              <button type="button" onClick={addManualCollection} style={buttonStyle}>
                Add existing
              </button>
            </div>
            <FieldLabel label="Active collection contract">
              <select
                value={selectedCollection}
                onChange={(event) => {
                  setSelectedCollection(event.target.value);
                  if (selected) updateSelected({ collectionAddress: event.target.value });
                }}
                style={inputStyle}
              >
                <option value="">Select collection contract</option>
                {collections.map((collection) => (
                  <option key={collection.address} value={collection.address}>
                    {collection.name} ({collection.symbol})
                    {collection.version ? ` v${collection.version}` : ""}
                    {" - "}
                    {shortAddress(collection.address)}
                  </option>
                ))}
              </select>
            </FieldLabel>
            {selectedCollectionMeta ? (
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                Selected: {selectedCollectionMeta.name} at {selectedCollectionMeta.address}
                {selectedCollectionMeta.version
                  ? ` | GalleryNFT v${selectedCollectionMeta.version}`
                  : " | version unknown until refreshed from chain"}
              </div>
            ) : null}
          </details>
          ) : null}
        </section>
      )}
    </main>
  );
}
