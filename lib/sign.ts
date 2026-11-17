// Server-side signing of bank confirmations (HMAC-SHA256).
// In test mode our "simulated bank" signs; in production the real bank signs with its own key
// and we only verify. A screenshot or a forged message can never produce a valid signature.
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.BANK_WEBHOOK_SECRET || "oggattu-test-mode-secret-change-me";

export function canonical(c: { ref: string; amount: number; utr: string; status: string; payerVpa: string; ts: number }) {
  return [c.ref, c.amount, c.utr, c.status, c.payerVpa, c.ts].join("|");
}

export function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function verify(payload: string, sig: string): boolean {
  const expected = Buffer.from(sign(payload), "hex");
  const given = Buffer.from(String(sig || ""), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
