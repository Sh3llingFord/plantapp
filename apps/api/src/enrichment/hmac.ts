import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SKEW_MS = 5 * 60 * 1000; // 5 Minuten, gegen Replay

function sign(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function signRequest(secret: string, rawBody: string) {
  const timestamp = Date.now().toString();
  return { timestamp, signature: sign(secret, timestamp, rawBody) };
}

export function verifySignature(
  secret: string,
  timestamp: string | undefined,
  signature: string | undefined,
  rawBody: string,
): boolean {
  if (!timestamp || !signature) return false;
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_SKEW_MS) return false;

  const expected = sign(secret, timestamp, rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
