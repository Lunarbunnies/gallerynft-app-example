import { bytesToHex, hexToBytes, keccak256 } from "./crypto";

export const PackedKind = {
  EVM: 0,
  TEZOS: 1,
} as const;

export type EvmPackedRefInput = {
  kind: "evm";
  chainId: bigint;
  contractAddress: string;
  tokenId: bigint;
};

export type TezosPackedRefInput = {
  kind: "tezos";
  tezosNet: number;
  contractHash: Uint8Array;
  tokenId: bigint;
};

export type PackedRefInput = EvmPackedRefInput | TezosPackedRefInput;

export type DecodedEvmPackedRef = {
  kind: "evm";
  chainId: bigint;
  contractAddress: string;
  tokenId: bigint;
};

export type DecodedTezosPackedRef = {
  kind: "tezos";
  tezosNet: number;
  contractHash: Uint8Array;
  contractHashHex: string;
  tokenId: bigint;
};

export type DecodedPackedRef = DecodedEvmPackedRef | DecodedTezosPackedRef;

function writeUint64BE(buf: Buffer, offset: number, value: bigint) {
  let v = value;
  for (let i = 7; i >= 0; i -= 1) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function writeUint96BE(buf: Buffer, offset: number, value: bigint) {
  let v = value;
  for (let i = 11; i >= 0; i -= 1) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function readUint64BE(buf: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 8; i += 1) {
    v = (v << 8n) | BigInt(buf[offset + i]);
  }
  return v;
}

function readUint96BE(buf: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 0; i < 12; i += 1) {
    v = (v << 8n) | BigInt(buf[offset + i]);
  }
  return v;
}

export function encodePackedRef(input: PackedRefInput): Uint8Array {
  if (input.kind === "evm") {
    const buf = Buffer.alloc(41);
    buf[0] = PackedKind.EVM;
    writeUint64BE(buf, 1, input.chainId);
    const contractBytes = hexToBytes(input.contractAddress);
    if (contractBytes.length !== 20) {
      throw new Error("EVM contract address must be 20 bytes");
    }
    Buffer.from(contractBytes).copy(buf, 9);
    writeUint96BE(buf, 29, input.tokenId);
    return buf;
  }

  const buf = Buffer.alloc(30);
  buf[0] = PackedKind.TEZOS;
  buf[1] = input.tezosNet & 0xff;
  if (input.contractHash.length !== 20) {
    throw new Error("Tezos contract hash must be 20 bytes");
  }
  Buffer.from(input.contractHash).copy(buf, 2);
  writeUint64BE(buf, 22, input.tokenId);
  return buf;
}

export function decodePackedRef(packed: Uint8Array | string): DecodedPackedRef {
  const bytes = typeof packed === "string" ? hexToBytes(packed) : packed;
  if (bytes.length < 1) {
    throw new Error("Packed ref is empty");
  }
  const kind = bytes[0];
  if (kind === PackedKind.EVM) {
    if (bytes.length !== 41) {
      throw new Error("Invalid EVM packed ref length");
    }
    const chainId = readUint64BE(bytes, 1);
    const contractBytes = bytes.slice(9, 29);
    const tokenId = readUint96BE(bytes, 29);
    return {
      kind: "evm",
      chainId,
      contractAddress: `0x${bytesToHex(contractBytes)}`,
      tokenId,
    };
  }

  if (kind === PackedKind.TEZOS) {
    if (bytes.length !== 30) {
      throw new Error("Invalid Tezos packed ref length");
    }
    const tezosNet = bytes[1];
    const contractHash = bytes.slice(2, 22);
    const tokenId = readUint64BE(bytes, 22);
    return {
      kind: "tezos",
      tezosNet,
      contractHash,
      contractHashHex: `0x${bytesToHex(contractHash)}`,
      tokenId,
    };
  }

  throw new Error("Unknown packed ref kind");
}

export function itemKey(packed: Uint8Array | string): string {
  const bytes = typeof packed === "string" ? hexToBytes(packed) : packed;
  const hash = keccak256(bytes);
  return `0x${bytesToHex(hash)}`;
}
