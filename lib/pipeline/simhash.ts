import { normalizeTitle } from "./text";

const MASK_64 = (1n << 64n) - 1n;
const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;

function fnv1a64(text: string): bigint {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK_64;
  }
  return hash;
}

/** Word 3-gram shingles; texts shorter than three words use their words. */
function shingles(text: string): string[] {
  const words = normalizeTitle(text).split(" ").filter(Boolean);
  if (words.length < 3) return words;
  return words.slice(0, -2).map((_, i) => words.slice(i, i + 3).join(" "));
}

/**
 * 64-bit SimHash of a text's word 3-grams, returned as a signed 64-bit value so it
 * round-trips through a Postgres bigint unchanged.
 */
export function simhash(text: string): bigint {
  const features = shingles(text);
  if (features.length === 0) return 0n;

  const weights = new Array<number>(64).fill(0);
  for (const feature of features) {
    const hash = fnv1a64(feature);
    for (let bit = 0; bit < 64; bit++) {
      weights[bit] += (hash >> BigInt(bit)) & 1n ? 1 : -1;
    }
  }

  let result = 0n;
  for (let bit = 0; bit < 64; bit++) {
    if (weights[bit] > 0) result |= 1n << BigInt(bit);
  }
  return BigInt.asIntN(64, result);
}

export function hammingDistance(a: bigint, b: bigint): number {
  let diff = BigInt.asUintN(64, a ^ b);
  let count = 0;
  while (diff) {
    diff &= diff - 1n;
    count++;
  }
  return count;
}
