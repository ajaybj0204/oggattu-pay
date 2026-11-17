"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { applyConfirmation, findShare, log, rupees, useLedger } from "@/lib/store";
import type { BankConfirmation } from "@/lib/types";

const LAST = "ogt.lastConfirmation";

async function bank(ref: string, amount: number, status: "SUCCESS" | "FAILURE", payerVpa: string): Promise<BankConfirmation> {
  return fetch("/api/bank/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref, amount, status, payerVpa }),
  }).then((r) => r.json());
}

function SimApp() {
  const params = useSearchParams();
  const { orders, merchant } = useLedger();
  const pending = orders.flatMap((o) => o.shares.filter((s) => s.status === "pending").map((s) => ({ ...s, orderId: o.id })));
  const [ref, setRef] = useState(params.get("ref") || "");
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ref && pending[0]) setRef(pending[0].ref);
  }, [pending, ref]);

  const target = ref ? findShare(ref) : null;
  const payerVpa = target ? `${target.share.payer.toLowerCase().replace(/[^a-z0-9]/g, "") || "customer"}@okbank` : "customer@okbank";

  async function pay(status: "SUCCESS" | "FAILURE") {
    if (!target) return;
    if (status === "SUCCESS" && pin !== "1234") return setResult({ ok: false, text: "Wrong UPI PIN (test PIN is 1234)" });
    setBusy(true);
    const c = await bank(target.share.ref, target.share.amount, status, payerVpa);
    sessionStorage.setItem(LAST, JSON.stringify(c));
    const r = await applyConfirmation(c);
    setResult({ ok: r.ok, text: r.ok ? `Paid ${rupees(c.amount)} · UTR ${c.utr}` : r.reason });
    setPin("");
    setBusy(false);
  }

  // ---------- Fraud Lab: each attack should be blocked by the merchant side ----------
  async function attack(kind: "screenshot" | "replay" | "tamper" | "underpay" | "forge") {
    setBusy(true);
    let r: { ok: boolean; reason: string };
    const last = JSON.parse(sessionStorage.getItem(LAST) || "null") as BankConfirmation | null;
    const victim = target?.share;
    switch (kind) {
      case "screenshot":
        log("block", `Fake "payment successful" screenshot shown for ${victim?.ref || "an order"}: ignored. Orders are confirmed only by the bank, never by screenshots.`);
        r = { ok: false, reason: "Screenshot ignored: no bank confirmation exists" };
        break;
      case "replay":
        if (!last) {
          r = { ok: false, reason: "Make one real test payment first, then replay it" };
          break;
        }
        r = await applyConfirmation(victim ? { ...last } : last);
        break;
      case "tamper":
        if (!victim) {
          r = { ok: false, reason: "Pick a pending payment first" };
          break;
        }
        {
          // Real bank signs ₹1, attacker edits the amount to the full bill after signing.
          const c = await bank(victim.ref, 100, "SUCCESS", "attacker@okbank");
          r = await applyConfirmation({ ...c, amount: victim.amount });
        }
        break;
      case "underpay":
        if (!victim) {
          r = { ok: false, reason: "Pick a pending payment first" };
          break;
        }
        {
          // Customer edits the amount in their UPI app and pays less. The bank honestly signs the smaller amount.
          const c = await bank(victim.ref, Math.max(100, Math.floor(victim.amount / 2)), "SUCCESS", payerVpa);
          r = await applyConfirmation(c);
        }
        break;
      case "forge":
        if (!victim) {
          r = { ok: false, reason: "Pick a pending payment first" };
          break;
        }
        r = await applyConfirmation({
          ref: victim.ref,
          amount: victim.amount,
          utr: "999999999999",
          status: "SUCCESS",
          payerVpa: "hacker@fake",
          ts: Date.now(),
          sig: "f".repeat(64),
        });
        break;
    }
    setResult({ ok: r.ok, text: (r.ok ? "⚠️ Attack succeeded: " : "🛡️ Blocked: ") + r.reason });
    setBusy(false);
  }

  return (
    <main className="wrap">
      <div className="grid g2" style={{ marginTop: 18, alignItems: "start" }}>
        <section className="phone">
          <div className="row between small" style={{ color: "#c8d3ff" }}>
            <b>Test UPI App</b>
            <span>simulated bank · test money</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="small" style={{ color: "#c8d3ff" }}>Payment request</label>
            <select value={ref} onChange={(e) => { setRef(e.target.value); setResult(null); }} style={{ background: "#0d1638", borderColor: "#2e3f86" }}>
              {!pending.length && <option value="">No pending payments: create an order in the Demo shop</option>}
              {pending.map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.ref} · {p.payer} · {rupees(p.amount)}
                </option>
              ))}
              {ref && !pending.some((p) => p.ref === ref) && <option value={ref}>{ref} (not pending)</option>}
            </select>
          </div>

          {target && target.share.status === "pending" ? (
            <>
              <p style={{ textAlign: "center", margin: "18px 0 0", color: "#c8d3ff" }}>
                Paying <b>{merchant.name}</b>
                <br />
                <span className="small">{merchant.vpa} · ref {target.share.ref}</span>
              </p>
              <div className="amt">{rupees(target.share.amount)}</div>
              <p style={{ textAlign: "center", margin: 0, color: "#c8d3ff" }} className="small">
                from {target.share.payer} ({payerVpa})
              </p>
              <div className="pin">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={pin.length > i ? "f" : ""} />
                ))}
              </div>
              <input
                inputMode="numeric"
                maxLength={4}
                placeholder="Enter UPI PIN (test: 1234)"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                style={{ textAlign: "center", letterSpacing: 6, background: "#0d1638", borderColor: "#2e3f86" }}
              />
              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn leaf" style={{ flex: 1 }} disabled={busy} onClick={() => pay("SUCCESS")}>Pay</button>
                <button className="btn red" disabled={busy} onClick={() => pay("FAILURE")}>Decline</button>
              </div>
            </>
          ) : (
            <p style={{ textAlign: "center", color: "#c8d3ff", margin: "30px 0" }}>
              {target ? `This request is ${target.share.status}.` : "Nothing to pay."}
            </p>
          )}
          {result && (
            <p style={{ textAlign: "center", marginTop: 14, color: result.ok ? "#7dffb3" : "#ffb3c4" }}>
              <b>{result.text}</b>
            </p>
          )}
        </section>

        <section className="card lab">
          <h2>🧪 Fraud Lab: try to cheat the merchant</h2>
          <p className="muted small">
            Each button is a real-world payment fraud. Pick a pending payment on the left, run an attack, then watch the Merchant dashboard
            log. Every attack should be blocked.
          </p>
          <div className="grid">
            {[
              ["screenshot", "Fake success screenshot", "Customer shows an edited \"Payment successful\" image at the counter."],
              ["replay", "Replay an old confirmation", "Re-send the last genuine bank confirmation to get a second order free (needs one real test payment first)."],
              ["tamper", "Edit the amount after signing", "Pay ₹1, then change the amount in the confirmation to the full bill."],
              ["underpay", "Pay a smaller amount", "Customer changes the amount inside their UPI app and pays half."],
              ["forge", "Forge a bank message", "Send a made-up SUCCESS confirmation without the bank's key."],
            ].map(([k, t, d]) => (
              <div className="share" key={k}>
                <div className="row between">
                  <b>{t}</b>
                  <button className="btn sm red" disabled={busy} onClick={() => attack(k as Parameters<typeof attack>[0])}>Run attack</button>
                </div>
                <div className="muted small">{d}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function Sim() {
  return (
    <Suspense>
      <SimApp />
    </Suspense>
  );
}
