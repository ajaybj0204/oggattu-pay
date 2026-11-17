"use client";
import Link from "next/link";
import QRCode from "qrcode";
import { use, useEffect, useState } from "react";
import { rupees, upiLink, useLedger } from "@/lib/store";
import type { Merchant, Share } from "@/lib/types";

function QR({ text }: { text: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setSrc).catch(() => {});
  }, [text]);
  return src ? <img className="qr" src={src} alt="UPI QR code" /> : <div className="qr" />;
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const s = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  return <span className="pill warn">⏱ {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")} left</span>;
}

function ShareCard({ share, merchant, orderId, single }: { share: Share; merchant: Merchant; orderId: string; single: boolean }) {
  const link = upiLink(merchant, share, `${merchant.name} ${orderId}`);
  const payUrl = typeof window !== "undefined" ? `${location.origin}/sim?ref=${share.ref}` : "";
  const wa = `https://wa.me/?text=${encodeURIComponent(`Hi ${share.payer}, your share for our ${merchant.name} order is ${rupees(share.amount)}. Pay here: ${payUrl}`)}`;
  return (
    <div className={`share ${share.status}`}>
      <div className="row between">
        <div>
          <b>{single ? "Scan to pay" : share.payer}</b>
          <div className="muted small">Ref {share.ref}</div>
        </div>
        <span className={`pill ${share.status === "paid" ? "ok" : share.status === "pending" ? "warn" : "bad"}`}>
          {share.status === "paid" ? "✓ Paid" : share.status === "pending" ? "Waiting" : share.status}
        </span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, margin: "8px 0" }}>{rupees(share.amount)}</div>
      {share.status === "paid" ? (
        <p className="small" style={{ color: "var(--leaf)", margin: 0 }}>
          UTR {share.utr} · verified by {share.verifiedBy === "bank-signature" ? "bank signature" : "UTR check"}
        </p>
      ) : share.status === "pending" ? (
        <>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <QR text={link} />
            <div className="grid" style={{ flex: 1, minWidth: 160 }}>
              <a className="btn leaf" href={link}>Open UPI app</a>
              <a className="btn" href={`/sim?ref=${share.ref}`} target="_blank" rel="noreferrer">Pay in Test UPI app ↗</a>
              {!single && <a className="btn sm" href={wa} target="_blank" rel="noreferrer">Send link on WhatsApp</a>}
              <span className="muted small">Any UPI app: GPay, PhonePe, Paytm, BHIM…</span>
            </div>
          </div>
        </>
      ) : (
        <p className="small" style={{ color: "var(--chili)", margin: 0 }}>This request {share.status}. Create a new order to retry.</p>
      )}
    </div>
  );
}

export default function Pay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { orders, merchant } = useLedger();
  const order = orders.find((o) => o.id === id);
  if (!order) {
    return (
      <main className="wrap">
        <div className="card" style={{ marginTop: 20 }}>
          Order not found in this browser. <Link href="/shop">Start a new order</Link>
        </div>
      </main>
    );
  }
  const paid = order.shares.filter((s) => s.status === "paid").length;
  return (
    <main className="wrap">
      <div className="row between" style={{ margin: "18px 0" }}>
        <div>
          <span className="pill">Order {order.id}</span>
          <h1 style={{ fontSize: 36 }}>
            Pay {merchant.name} · {rupees(order.total)}
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Paid directly to <b>{merchant.vpa}</b> over UPI · 0% fee · {order.together ? `Pay Together: ${paid}/${order.shares.length} paid` : "single payment"}
          </p>
        </div>
        {order.status !== "paid" && order.status !== "expired" && <Countdown until={order.expiresAt} />}
      </div>

      <div className={`kitchen ${order.kitchenReleased ? "go" : "wait"}`} style={{ marginBottom: 14 }}>
        {order.kitchenReleased
          ? `🍳 Sent to kitchen: all payments bank-verified. ${order.customer} earned ${order.pointsEarned} reward points.`
          : order.status === "expired"
            ? "⌛ Payment window expired: nothing was sent to the kitchen."
            : `⏳ Kitchen is waiting: the order starts only when ${order.together ? "everyone's payment is" : "the payment is"} verified by the bank.`}
      </div>

      <div className={`grid ${order.shares.length > 1 ? "g2" : ""}`}>
        {order.shares.map((s) => (
          <ShareCard key={s.ref} share={s} merchant={merchant} orderId={order.id} single={!order.together} />
        ))}
      </div>

      <p className="muted small" style={{ marginTop: 14 }}>
        Test mode: tap <b>Pay in Test UPI app</b> to approve with PIN 1234. Our simulated bank sends a signed confirmation; this page
        updates by itself. A real UPI app also works with the QR, but in test mode nobody confirms it, which is exactly why screenshots
        are never trusted.
      </p>
    </main>
  );
}
