import { promises as dns } from "dns";

type Metadata = {
  name?: string;
  description?: string;
  image?: string;
  image_url?: string;
  artifactUri?: string;
  displayUri?: string;
  thumbnailUri?: string;
  animation_url?: string;
  animation_details?: { format?: string };
  created_by?: string;
  artist?: string;
  creators?: string[];
  authors?: string[];
  formats?: Array<{ uri?: string; mimeType?: string }>;
  attributes?: Array<{ trait_type?: string; value?: string | number }>;
};

const MAX_METADATA_BYTES = 1024 * 1024;

export function resolveUri(uri: string) {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  }
  if (uri.startsWith("ar://")) {
    return `https://arweave.net/${uri.replace("ar://", "")}`;
  }
  return uri;
}

export function normalizeImageUrl(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("data:image/svg+xml;utf8,")) {
    const raw = url.replace("data:image/svg+xml;utf8,", "");
    const base64 = Buffer.from(raw, "utf8").toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }
  return url;
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9")) return true;
  if (normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  return false;
}

async function assertSafeUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Only https:// URLs are allowed for metadata fetch");
  }
  if (parsed.hostname === "localhost") {
    throw new Error("Localhost is not allowed");
  }
  const lookups = await dns.lookup(parsed.hostname, { all: true });
  for (const entry of lookups) {
    if (entry.family === 4 && isPrivateIpv4(entry.address)) {
      throw new Error("Private IPs are not allowed");
    }
    if (entry.family === 6 && isPrivateIpv6(entry.address)) {
      throw new Error("Private IPs are not allowed");
    }
  }
}

function decodeDataUri(uri: string) {
  const match = uri.match(/^data:application\/json;base64,(.+)$/);
  if (!match) {
    throw new Error("Unsupported data URI");
  }
  const json = Buffer.from(match[1], "base64").toString("utf8");
  return JSON.parse(json) as Metadata;
}

async function readJsonWithLimit(response: Response) {
  if (!response.body) {
    throw new Error("Empty response body");
  }

  const reader = (response.body as ReadableStream<Uint8Array>).getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_METADATA_BYTES) {
      throw new Error("Metadata response too large");
    }
    return JSON.parse(buffer.toString("utf8")) as Metadata;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > MAX_METADATA_BYTES) {
        throw new Error("Metadata response too large");
      }
      chunks.push(value);
    }
  }

  const buffer = Buffer.concat(chunks);
  return JSON.parse(buffer.toString("utf8")) as Metadata;
}

async function fetchJson(url: string) {
  await assertSafeUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
    });
    if (!response.ok) {
      throw new Error(`Metadata fetch failed: ${response.status}`);
    }
    return await readJsonWithLimit(response);
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeMetadata(metadata: Metadata) {
  const image = metadata.image_url || metadata.image || metadata.displayUri || metadata.thumbnailUri;
  const imageUrl = image ? normalizeImageUrl(resolveUri(image)) : null;
  const animationCandidate =
    metadata.animation_url ||
    metadata.artifactUri ||
    metadata.formats?.find((format) => {
      const mime = format.mimeType?.toLowerCase() || "";
      return mime.includes("video") || mime.includes("html") || mime.includes("svg");
    })?.uri ||
    null;
  const animationUrl = animationCandidate ? resolveUri(animationCandidate) : null;
  const animationFormat = metadata.formats?.find((format) => {
    if (!format.uri || !animationCandidate) return false;
    return format.uri === animationCandidate || resolveUri(format.uri) === animationUrl;
  });
  const richFormat = metadata.formats?.find((format) => {
    const mime = format.mimeType?.toLowerCase() || "";
    return mime.includes("video") || mime.includes("html") || mime.includes("svg");
  });
  const artistAttribute = metadata.attributes?.find((attribute) => {
    const trait = attribute.trait_type?.toLowerCase();
    return trait === "artist" || trait === "creator" || trait === "created by";
  });
  const artist =
    metadata.artist ||
    metadata.created_by ||
    metadata.creators?.join(", ") ||
    metadata.authors?.join(", ") ||
    (artistAttribute?.value !== undefined ? String(artistAttribute.value) : null);

  return {
    raw: metadata,
    name: metadata.name || null,
    description: metadata.description || null,
    imageUrl,
    animationUrl,
    animationMime: metadata.animation_details?.format || animationFormat?.mimeType || richFormat?.mimeType || null,
    artist,
  };
}

export async function fetchTokenMetadata(tokenUri: string) {
  let metadata: Metadata;
  if (tokenUri.startsWith("data:")) {
    metadata = decodeDataUri(tokenUri);
  } else {
    const resolved = resolveUri(tokenUri);
    metadata = await fetchJson(resolved);
  }

  return normalizeMetadata(metadata);
}

export async function fetchTezosTokenMetadata(contractAddress: string, tokenId: string) {
  const url = `https://api.tzkt.io/v1/tokens?contract=${encodeURIComponent(
    contractAddress
  )}&tokenId=${encodeURIComponent(tokenId)}&limit=1`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  if (!response.ok) {
    throw new Error(`TzKT metadata fetch failed: ${response.status}`);
  }
  const rows = (await response.json()) as Array<{
    metadata?: Metadata;
    displayUri?: string;
    artifactUri?: string;
    thumbnailUri?: string;
  }>;
  const token = rows[0];
  if (!token) {
    throw new Error("Tezos token not found");
  }
  const metadata = {
    ...(token.metadata || {}),
    displayUri: token.metadata?.displayUri || token.displayUri,
    artifactUri: token.metadata?.artifactUri || token.artifactUri,
    thumbnailUri: token.metadata?.thumbnailUri || token.thumbnailUri,
  };
  return normalizeMetadata(metadata);
}
