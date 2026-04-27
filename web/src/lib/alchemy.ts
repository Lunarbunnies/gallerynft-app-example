type RpcResponse = {
  jsonrpc: string;
  id: number;
  result?: string;
  error?: { message?: string };
};

function getAlchemyRpcUrl(chainId: number) {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error("ALCHEMY_API_KEY is not set");
  }

  const map: Record<number, string> = {
    1: "https://eth-mainnet.g.alchemy.com/v2/",
    137: "https://polygon-mainnet.g.alchemy.com/v2/",
    8453: "https://base-mainnet.g.alchemy.com/v2/",
  };

  const baseUrl = map[chainId];
  if (!baseUrl) {
    throw new Error(
      `Unsupported chainId ${chainId}. Supported: ${Object.keys(map).join(", ")}.`
    );
  }

  return `${baseUrl}${apiKey}`;
}

function getAlchemyNftUrl(chainId: number) {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error("ALCHEMY_API_KEY is not set");
  }

  const map: Record<number, string> = {
    1: "https://eth-mainnet.g.alchemy.com/nft/v2/",
    137: "https://polygon-mainnet.g.alchemy.com/nft/v2/",
    8453: "https://base-mainnet.g.alchemy.com/nft/v2/",
  };

  const baseUrl = map[chainId];
  if (!baseUrl) {
    throw new Error(
      `Unsupported chainId ${chainId}. Supported: ${Object.keys(map).join(", ")}.`
    );
  }

  return `${baseUrl}${apiKey}`;
}

function pad32(hex: string) {
  return hex.padStart(64, "0");
}

function encodeUint256(value: string | number | bigint) {
  const v = BigInt(value);
  return pad32(v.toString(16));
}

function decodeAbiString(hexData: string) {
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

async function rpcCall(url: string, to: string, data: string) {
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_call",
    params: [
      {
        to,
        data,
      },
      "latest",
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Alchemy RPC failed: ${response.status}`);
  }

  const json = (await response.json()) as RpcResponse;
  if (json.error) {
    throw new Error(json.error.message || "RPC error");
  }
  if (!json.result) {
    throw new Error("Empty RPC result");
  }
  return json.result;
}

async function getErc1967Implementation(url: string, proxyAddress: string) {
  const implSlot =
    "0x360894A13BA1A3210667C828492DB98DCA3E2076CC3735A920A3CA505D382BBC";
  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getStorageAt",
    params: [proxyAddress, implSlot, "latest"],
  };
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Alchemy RPC failed: ${response.status}`);
  }
  const json = (await response.json()) as RpcResponse;
  if (json.error) {
    throw new Error(json.error.message || "RPC error");
  }
  if (!json.result || json.result === "0x") {
    return null;
  }
  const hex = json.result.replace("0x", "");
  if (hex.length !== 64) {
    return null;
  }
  const address = `0x${hex.slice(24)}`;
  if (address === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return address;
}

export async function fetchEvmTokenUri(
  chainId: number,
  contractAddress: string,
  tokenId: string | number | bigint
) {
  const url = getAlchemyRpcUrl(chainId);
  const tokenIdHex = encodeUint256(tokenId);

  const erc721Selector = "0xc87b56dd";
  const erc1155Selector = "0x0e89341c";

  const data721 = `${erc721Selector}${tokenIdHex}`;
  const data1155 = `${erc1155Selector}${tokenIdHex}`;

  try {
    const result = await rpcCall(url, contractAddress, data721);
    return decodeAbiString(result);
  } catch (_err) {
    try {
      const result = await rpcCall(url, contractAddress, data1155);
      return decodeAbiString(result);
    } catch (_err2) {
      const impl = await getErc1967Implementation(url, contractAddress);
      if (!impl) {
        throw _err2;
      }
      try {
        const result = await rpcCall(url, impl, data721);
        return decodeAbiString(result);
      } catch (_err3) {
        const result = await rpcCall(url, impl, data1155);
        return decodeAbiString(result);
      }
    }
  }
}

export async function fetchEvmMetadataFallback(
  chainId: number,
  contractAddress: string,
  tokenId: string | number | bigint
) {
  const baseUrl = getAlchemyNftUrl(chainId);
  const url = `${baseUrl}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}&refreshCache=true`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Alchemy NFT API failed: ${response.status}`);
  }
  const json = await response.json();
  return json;
}
