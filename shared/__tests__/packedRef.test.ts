import { describe, expect, it } from "vitest";
import { keccak_256 } from "@noble/hashes/sha3";
import {
  decodePackedRef,
  encodePackedRef,
  itemKey,
} from "../packedRef";
import { evmFixture, tezosFixture } from "./fixtures";
import { hexToBytes } from "../crypto";
import { kt1ToHashBytes20 } from "../tezos";

describe("packedRef", () => {
  it("encodes and decodes EVM packed refs", () => {
    const encoded = encodePackedRef({
      kind: "evm",
      chainId: evmFixture.chainId,
      contractAddress: evmFixture.contractAddress,
      tokenId: evmFixture.tokenId,
    });
    expect(`0x${Buffer.from(encoded).toString("hex")}`).toBe(
      evmFixture.packedRefHex
    );

    const decoded = decodePackedRef(encoded);
    expect(decoded.kind).toBe("evm");
    if (decoded.kind === "evm") {
      expect(decoded.chainId).toBe(evmFixture.chainId);
      expect(decoded.contractAddress).toBe(evmFixture.contractAddress);
      expect(decoded.tokenId).toBe(evmFixture.tokenId);
    }
  });

  it("encodes and decodes Tezos packed refs", () => {
    const encoded = encodePackedRef({
      kind: "tezos",
      tezosNet: tezosFixture.tezosNet,
      contractHash: hexToBytes(tezosFixture.contractHashHex),
      tokenId: tezosFixture.tokenId,
    });
    expect(`0x${Buffer.from(encoded).toString("hex")}`).toBe(
      tezosFixture.packedRefHex
    );

    const decoded = decodePackedRef(encoded);
    expect(decoded.kind).toBe("tezos");
    if (decoded.kind === "tezos") {
      expect(decoded.tezosNet).toBe(tezosFixture.tezosNet);
      expect(decoded.contractHashHex).toBe(tezosFixture.contractHashHex);
      expect(decoded.tokenId).toBe(tezosFixture.tokenId);
    }
  });

  it("computes itemKey via keccak256", () => {
    const packed = hexToBytes(evmFixture.packedRefHex);
    const expected = `0x${Buffer.from(keccak_256(packed)).toString("hex")}`;
    expect(itemKey(packed)).toBe(expected);
  });

  it("decodes KT1 contract hash", () => {
    const address = "KT1RJ6PbjHpwc3M5rw5s2Nbmefwbuwbdxton";
    const bytes = kt1ToHashBytes20(address);
    expect(bytes.length).toBe(20);
  });
});
