import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const PAIRING_TTL_MS = 24 * 60 * 60 * 1000;

export function generatePairingCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function hashPairingCode(code: string, pepper: string): string {
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}

export function verifyPairingCode(code: string, hash: string, pepper: string): boolean {
  const actual = Buffer.from(hashPairingCode(code, pepper), "utf8");
  const expected = Buffer.from(hash, "utf8");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
