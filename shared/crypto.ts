import { keccak_256 } from "@noble/hashes/sha3";

export function keccak256(data: Uint8Array): Uint8Array {
  return keccak_256(data);
}

export function bytesToHex(data: Uint8Array): string {
  return Buffer.from(data).toString("hex");
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(normalized, "hex");
}
