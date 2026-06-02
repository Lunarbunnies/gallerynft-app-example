import { keccak256 } from "ethers";
import { kt1ToHashBytes20 } from "@onchain-gallery/shared";

function writeUint64BE(buf: Uint8Array, offset: number, value: bigint) {
  let v = value;
  for (let i = 7; i >= 0; i -= 1) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function writeUint96BE(buf: Uint8Array, offset: number, value: bigint) {
  let v = value;
  for (let i = 11; i >= 0; i -= 1) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function hexToBytes(hex: string) {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]*$/.test(normalized) || normalized.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  return Uint8Array.from(normalized.match(/.{2}/g)?.map((part) => parseInt(part, 16)) || []);
}

function bytesToHex(bytes: Uint8Array) {
  return `0x${Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function encodeEvmPackedRef(chainId: string, contractAddress: string, tokenId: string) {
  const out = new Uint8Array(41);
  out[0] = 0;
  writeUint64BE(out, 1, BigInt(chainId));
  const contractBytes = hexToBytes(contractAddress);
  if (contractBytes.length !== 20) {
    throw new Error("EVM contract address must be 20 bytes");
  }
  out.set(contractBytes, 9);
  writeUint96BE(out, 29, BigInt(tokenId));
  return bytesToHex(out);
}

export function encodeTezosPackedRef(contractAddress: string, tokenId: string, tezosNet = 0) {
  const out = new Uint8Array(30);
  out[0] = 1;
  out[1] = tezosNet & 0xff;
  const contractBytes = kt1ToHashBytes20(contractAddress.trim());
  out.set(contractBytes, 2);
  writeUint64BE(out, 22, BigInt(tokenId));
  return bytesToHex(out);
}

export function itemKeyFromPackedRef(packedRef: string) {
  return keccak256(packedRef);
}
