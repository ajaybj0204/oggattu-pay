"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createOrder, rupees, splitEvenly, useLedger } from "@/lib/store";
import type { LineItem } from "@/lib/types";

const MENU: Omit<LineItem, "qty">[] = [
  { id: "bisi", name: "Bisi Bele Bath", price: 14000 },
  { id: "neer", name: "Neer Dosa (3) + Chutney", price: 9000 },
  { id: "ragi", name: "Ragi Mudde + Saaru", price: 16000 },
  { id: "akki", name: "Akki Rotti", price: 11000 },
  { id: "mysore", name: "Mysore Masala Dosa", price: 12000 },
  { id: "kaapi", name: "Filter Kaapi", price: 4000 },
];

export default function Shop() {
  const router = useRouter();
  const { points, merchant } = useLedger();
  const [qty, setQty] = useState<Record<string, number>>({ bisi: 1, mysore: 2, kaapi: 3 });
  const [customer, setCustomer] = useState("Ajay");
  const [together, setTogether] = useState(false);
  const [friends, setFriends] = useState("Rahul, Priya, Kiran");
  const [usePoints, setUsePoints] = useState(true);

  const items: LineItem[] = MENU.filter((m) => qty[m.id]).map((m) => ({ ...m, qty: qty[m.id] }));
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const myPoints = points[customer.trim().toLowerCase()] || 0;
  const pointsUsable = usePoints ? Math.min(myPoints, Math.floor((subtotal / 100) * 0.2)) : 0;
  const total = subtotal - pointsUsable * 100;
  const payers = together ? [customer, ...friends.split(",").map((f) => f.trim()).filter(Boolean)] : [customer];
  const shares = splitEvenly(total, payers.length);
  const gatewayFee = Math.round((total * merchant.pgFeePercent) / 100);

  function checkout() {
    if (!items.length || !customer.trim()) return;
    const o = createOrder({ items, customer: customer.trim(), payers, pointsUsed: pointsUsable });
    router.push(`/pay/${o.id}`);
  }

  return (
    <main className="wrap">
      <div className="row between" style={{ margin: "18px 0" }}>
        <div>
          <span className="pill">Demo merchant</span>
          <h1 style={{ fontSize: 38 }}>
            {merchant.name} <span className="kn">ಮನೆ & ಒಗ್ಗರಣೆ</span>
          </h1>
          <p className="muted" style={{ margin: 0 }}>Karnataka home food · pays directly to {merchant.vpa}</p>
        </div>
      </div>

      <div className="grid g2">
        <section className="card">
          <h2>Menu</h2>
          <div className="grid">
            {MENU.map((m) => (
              <div className="menu-item" key={m.id}>
                <div>
                  <b>{m.name}</b>
                  <div className="muted small">{rupees(m.price)}</div>
                </div>
                <div className="qty">
                  <button onClick={() => setQty((q) => ({ ...q, [m.id]: Math.max(0, (q[m.id] || 0) - 1) }))}>−</button>
                  <b style={{ minWidth: 18, textAlign: "center" }}>{qty[m.id] || 0}</b>
                  <button onClick={() => setQty((q) => ({ ...q, [m.id]: (q[m.id] || 0) + 1 }))}>+</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Checkout · Oggattu Pay</h2>
          <label className="small muted">Your name</label>
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} />

          <div className="share" style={{ marginTop: 12 }}>
            <label className="row">
              <input type="checkbox" checked={together} onChange={(e) => setTogether(e.target.checked)} style={{ width: 18 }} />
              <b>Pay Together</b> <span className="muted small">split the bill, one UPI link each</span>
            </label>
            {together && (
              <>
                <label className="small muted" style={{ display: "block", marginTop: 8 }}>Friends (comma separated)</label>
                <input value={friends} onChange={(e) => setFriends(e.target.value)} />
              </>
            )}
          </div>

          <div className="share" style={{ marginTop: 10 }}>
            <label className="row">
              <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} style={{ width: 18 }} />
              <b>Use reward points</b>
              <span className="muted small">
                {myPoints} available{myPoints ? ` · up to 20% of bill` : " · earn 5% back on every order"}
              </span>
            </label>
          </div>

          <table style={{ marginTop: 12 }}>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.name} × {i.qty}</td>
                  <td style={{ textAlign: "right" }}>{rupees(i.price * i.qty)}</td>
                </tr>
              ))}
              {pointsUsable > 0 && (
                <tr>
                  <td className="muted">Reward points</td>
                  <td style={{ textAlign: "right", color: "var(--leaf)" }}>−{rupees(pointsUsable * 100)}</td>
                </tr>
              )}
              <tr>
                <td><b>Total</b></td>
                <td style={{ textAlign: "right" }}><b>{rupees(total)}</b></td>
              </tr>
            </tbody>
          </table>

          {together && (
            <p className="small muted">
              Split: {payers.map((p, i) => `${p} ${rupees(shares[i])}`).join(" · ")}
            </p>
          )}
          <p className="small" style={{ color: "var(--leaf)" }}>
            Merchant receives the full {rupees(total)}. A {merchant.pgFeePercent}% gateway would have taken {rupees(gatewayFee)}.
          </p>
          <button className="btn go" style={{ width: "100%" }} disabled={!items.length || !customer.trim()} onClick={checkout}>
            Pay {rupees(total)} with UPI · ₹0 fee →
          </button>
        </section>
      </div>
    </main>
  );
}
