"use client";
import { useEffect, useRef, useState } from "react";
import { confirmByUtr, resetDemo, rupees, setMerchant, useLedger } from "@/lib/store";
import type { Merchant } from "@/lib/types";

function speak(text: string, lang: "en" | "kn") {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "kn" ? "kn-IN" : "en-IN";
  const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith(lang === "kn" ? "kn" : "en-IN"));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

export default function MerchantPage() {
  const { merchant, orders, log, points } = useLedger();
  const [voice, setVoice] = useState<"off" | "en" | "kn">("off");
  const [utrForm, setUtrForm] = useState({ ref: "", utr: "", amount: "" });
  const [msg, setMsg] = useState("");
  const [edit, setEdit] = useState<Merchant>(merchant);
  const savedJson = JSON.stringify(merchant);
  useEffect(() => setEdit(JSON.parse(savedJson)), [savedJson]); // show saved settings once loaded
  const lastSpoken = useRef<string>("");

  // Voice receipt: announce each newly verified payment, like a soundbox.
  useEffect(() => {
    const latest = log.find((l) => l.kind === "ok" && l.text.includes("received from"));
    if (!latest || latest.at === lastSpoken.current) return;
    const first = !lastSpoken.current;
    lastSpoken.current = latest.at;
    if (first || voice === "off") return;
    const m = latest.text.match(/₹([\d,.]+) received from (.+?) for/);
    if (m) {
      speak(
        voice === "kn" ? `${m[1]} ರೂಪಾಯಿ ಬಂದಿದೆ, ${m[2]} ಇಂದ` : `${m[1]} rupees received from ${m[2]}`,
        voice,
      );
    }
  }, [log, voice]);

  const shares = orders.flatMap((o) => o.shares.map((s) => ({ ...s, order: o })));
  const received = shares.filter((s) => s.status === "paid");
  const collected = received.reduce((a, s) => a + s.amount, 0);
  const expected = orders.filter((o) => o.status !== "expired").reduce((a, o) => a + o.total, 0);
  const pending = shares.filter((s) => s.status === "pending");
  const saved = Math.round((collected * merchant.pgFeePercent) / 100);
  const blocked = log.filter((l) => l.kind === "block").length;

  function submitUtr() {
    const r = confirmByUtr(utrForm.ref, utrForm.utr.trim(), Math.round(Number(utrForm.amount) * 100));
    setMsg(r.ok ? "✓ " + r.reason : "✗ " + r.reason);
    if (r.ok) setUtrForm({ ref: "", utr: "", amount: "" });
  }

  return (
    <main className="wrap">
      <div className="row between" style={{ margin: "18px 0" }}>
        <div>
          <span className="pill">Merchant dashboard</span>
          <h1 style={{ fontSize: 36 }}>{merchant.name}</h1>
          <p className="muted" style={{ margin: 0 }}>Payments land directly in {merchant.vpa} · live, syncs with the other tabs</p>
        </div>
        <div className="row">
          <span className="muted small">Voice receipt</span>
          {(["off", "en", "kn"] as const).map((v) => (
            <button key={v} className={`btn sm ${voice === v ? "go" : ""}`} onClick={() => { setVoice(v); if (v !== "off") speak(v === "kn" ? "ಧ್ವನಿ ರಸೀದಿ ಆನ್ ಆಗಿದೆ" : "Voice receipts on", v); }}>
              {v === "off" ? "Off" : v === "en" ? "English" : "ಕನ್ನಡ"}
            </button>
          ))}
        </div>
      </div>

      <section className="grid g4">
        <div className="card stat"><span className="muted small">Collected (bank-verified)</span><b>{rupees(collected)}</b></div>
        <div className="card stat"><span className="muted small">Fees saved vs {merchant.pgFeePercent}% gateway</span><b style={{ color: "var(--leaf)" }}>{rupees(saved)}</b></div>
        <div className="card stat"><span className="muted small">Awaiting payment</span><b style={{ color: "var(--saffron)" }}>{pending.length} share{pending.length === 1 ? "" : "s"}</b></div>
        <div className="card stat"><span className="muted small">Fraud attempts blocked</span><b style={{ color: "var(--chili)" }}>{blocked}</b></div>
      </section>

      <section className="grid g2" style={{ marginTop: 14, alignItems: "start" }}>
        <div className="card">
          <h2>Live activity</h2>
          <div className="log">
            {!log.length && <div className="info">No activity yet. Place an order in the Demo shop.</div>}
            {log.map((l, i) => (
              <div key={i} className={l.kind}>
                <span className="muted">{new Date(l.at).toLocaleTimeString("en-IN")} · </span>
                {l.text}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Reconciliation</h2>
          <table>
            <tbody>
              <tr><td className="muted">Orders (not expired)</td><td style={{ textAlign: "right" }}>{rupees(expected)}</td></tr>
              <tr><td className="muted">Received &amp; bank-verified</td><td style={{ textAlign: "right", color: "var(--leaf)" }}>{rupees(collected)}</td></tr>
              <tr><td className="muted">Still pending</td><td style={{ textAlign: "right", color: "var(--saffron)" }}>{rupees(expected - collected)}</td></tr>
              <tr><td className="muted">Every UTR unique</td><td style={{ textAlign: "right" }}>{new Set(received.map((r) => r.utr)).size === received.length ? "✓ yes" : "✗ duplicates!"}</td></tr>
            </tbody>
          </table>

          <h2 style={{ marginTop: 18 }}>Pilot: confirm a real UPI payment</h2>
          <p className="muted small">Real money to your UPI ID? Enter the UTR and amount from your bank SMS/statement. Duplicates and wrong amounts are blocked.</p>
          <div className="grid g3">
            <select value={utrForm.ref} onChange={(e) => setUtrForm({ ...utrForm, ref: e.target.value })}>
              <option value="">Pending ref…</option>
              {pending.map((p) => <option key={p.ref} value={p.ref}>{p.ref} · {rupees(p.amount)}</option>)}
            </select>
            <input placeholder="12-digit UTR" value={utrForm.utr} onChange={(e) => setUtrForm({ ...utrForm, utr: e.target.value.replace(/\D/g, "").slice(0, 12) })} />
            <input placeholder="Amount ₹" inputMode="decimal" value={utrForm.amount} onChange={(e) => setUtrForm({ ...utrForm, amount: e.target.value })} />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm go" disabled={!utrForm.ref || !utrForm.utr} onClick={submitUtr}>Confirm by UTR</button>
            {msg && <span className="small">{msg}</span>}
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14, overflowX: "auto" }}>
        <h2>Payments</h2>
        <table>
          <thead>
            <tr><th>Ref</th><th>Payer</th><th>Amount</th><th>Status</th><th>UTR</th><th>Verified by</th><th>Order</th></tr>
          </thead>
          <tbody>
            {shares.map((s) => (
              <tr key={s.ref}>
                <td>{s.ref}</td>
                <td>{s.payer}</td>
                <td>{rupees(s.amount)}</td>
                <td><span className={`pill ${s.status === "paid" ? "ok" : s.status === "pending" ? "warn" : "bad"}`}>{s.status}</span></td>
                <td>{s.utr || "-"}</td>
                <td className="muted">{s.verifiedBy || "-"}</td>
                <td className="muted">{s.order.together ? `Pay Together (${s.order.shares.length})` : "Single"} · {s.order.kitchenReleased ? "🍳 kitchen" : s.order.status}</td>
              </tr>
            ))}
            {!shares.length && <tr><td colSpan={7} className="muted">No payments yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="grid g2" style={{ marginTop: 14, alignItems: "start" }}>
        <div className="card">
          <h2>Neighbourhood rewards</h2>
          <p className="muted small">5% back as points on every paid order. Usable here and at <b>{merchant.partner}</b>. Points are discount-only: they can&apos;t be bought, transferred or cashed out, so they&apos;re not a wallet.</p>
          <table>
            <tbody>
              {Object.entries(points).map(([who, p]) => (
                <tr key={who}><td style={{ textTransform: "capitalize" }}>{who}</td><td style={{ textAlign: "right" }}>{p} points (= {rupees(p * 100)} off)</td></tr>
              ))}
              {!Object.keys(points).length && <tr><td className="muted">No points yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Settings</h2>
          <div className="grid g2">
            <label className="small muted">Shop name<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="small muted">Your UPI ID (money goes here)<input value={edit.vpa} onChange={(e) => setEdit({ ...edit, vpa: e.target.value.trim() })} /></label>
            <label className="small muted">Partner shop<input value={edit.partner} onChange={(e) => setEdit({ ...edit, partner: e.target.value })} /></label>
            <label className="small muted">Mode
              <select value={edit.mode} onChange={(e) => setEdit({ ...edit, mode: e.target.value as Merchant["mode"] })}>
                <option value="test">Test (simulated bank)</option>
                <option value="pilot">Pilot (real UPI + UTR check)</option>
              </select>
            </label>
          </div>
          {edit.mode === "pilot" && (
            <p className="small" style={{ color: "var(--saffron)" }}>
              Pilot uses REAL money: QR codes will pay {edit.vpa}. Test with ₹1–₹10 from your own phone only.
            </p>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn sm go" onClick={() => { setMerchant(edit); setMsg("Settings saved"); }}>Save settings</button>
            <button className="btn sm red" onClick={() => confirm("Clear all demo orders, points and logs?") && resetDemo()}>Reset demo data</button>
          </div>
        </div>
      </section>
    </main>
  );
}
