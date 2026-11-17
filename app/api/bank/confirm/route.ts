// TEST MODE ONLY: a simulated bank. When the customer approves in the test UPI app,
// this issues a UTR and a signed SUCCESS/FAILURE confirmation, like a bank's UPI callback.
import { canonical, sign } from "@/lib/sign";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const ref = String(b.ref || "").slice(0, 40);
  const amount = Math.round(Number(b.amount));
  const status = b.status === "FAILURE" ? "FAILURE" : "SUCCESS";
  const payerVpa = String(b.payerVpa || "customer@testbank").slice(0, 60);
  if (!ref || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "ref and a positive amount are required" }, { status: 400 });
  }
  // 12-digit UTR, like real UPI references
  const utr = String(Date.now()).slice(-8) + String(Math.floor(1000 + Math.random() * 9000));
  const ts = Date.now();
  const c = { ref, amount, utr, status, payerVpa, ts };
  return Response.json({ ...c, sig: sign(canonical(c)) });
}
