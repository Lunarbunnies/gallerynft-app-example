import bs58check from "bs58check";

const KT1_PREFIX = Buffer.from([2, 90, 121]);

export function kt1ToHashBytes20(address: string): Uint8Array {
  const decoded = bs58check.decode(address);
  if (decoded.length !== KT1_PREFIX.length + 20) {
    throw new Error("Invalid KT1 address length");
  }
  const prefix = decoded.subarray(0, KT1_PREFIX.length);
  if (!Buffer.from(prefix).equals(KT1_PREFIX)) {
    throw new Error("Invalid KT1 prefix");
  }
  return decoded.subarray(KT1_PREFIX.length);
}
