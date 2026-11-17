// The merchant side: checks a bank confirmation before an order is marked paid.
// 1) signature must be valid (not forged or edited)
// 2) it must be fresh (no replaying an old message)
// 3) the amount must match what was asked for
// Duplicate UTRs and expired orders are checked in the ledger (see lib/store.ts).
import { canonical, verify } from "@/lib/sign";

export const runtime = "nodejs";

const MAX_AGE_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  const { confirmation: c, expectedAmount, expectedRef } = await req.json().catch(() => ({}));
  if (!c) return Response.json({ valid: false, reason: "No confirmation" });
  if (!verify(canonical(c), c.sig)) return Response.json({ valid: false, reason: "Invalid bank signature: message was forged or edited" });
  if (Date.now() - Number(c.ts) > MAX_AGE_MS) return Response.json({ valid: false, reason: "Confirmation too old: possible replay" });
  if (expectedRef && c.ref !== expectedRef) return Response.json({ valid: false, reason: "Reference doesn't match this order" });
  if (Number(c.amount) !== Number(expectedAmount)) return Response.json({ valid: false, reason: `Amount mismatch: paid ₹${(c.amount / 100).toFixed(2)}, expected ₹${(expectedAmount / 100).toFixed(2)}. Not accepted; refund or collect the difference.` });
  if (c.status !== "SUCCESS") return Response.json({ valid: false, reason: "Bank reported the payment as failed" });
  return Response.json({ valid: true });
}
