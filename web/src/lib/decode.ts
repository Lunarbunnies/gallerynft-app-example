import { decodePackedRef } from "@onchain-gallery/shared";

export function formatPackedRefSummary(packedRefHex: string): string {
  return getPackedRefDisplay(packedRefHex).summary;
}

export function getPackedRefDisplay(packedRefHex: string) {
  const decoded = decodePackedRef(packedRefHex);
  if (decoded.kind === "evm") {
    const chainId = decoded.chainId.toString();
    const nameMap: Record<string, string> = {
      "1": "Ethereum",
      "11155111": "Sepolia",
      "8453": "Base",
      "137": "Polygon",
    };
    const chainName = nameMap[chainId] || `Chain ${chainId}`;
    const short = shortenHex(decoded.contractAddress);
    return {
      summary: `${chainName} ${short} #${decoded.tokenId.toString()}`,
      full: `${chainName} ${decoded.contractAddress} #${decoded.tokenId.toString()}`,
    };
  }
  const tezosShort = shortenHex(decoded.contractHashHex);
  return {
    summary: `Tezos net ${decoded.tezosNet} ${tezosShort} #${decoded.tokenId.toString()}`,
    full: `Tezos net ${decoded.tezosNet} ${decoded.contractHashHex} #${decoded.tokenId.toString()}`,
  };
}

function shortenHex(hex: string) {
  const normalized = hex.startsWith("0x") ? hex : `0x${hex}`;
  if (normalized.length <= 10) return normalized;
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
}
