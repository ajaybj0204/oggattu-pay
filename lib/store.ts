"use client";
// The demo ledger. In this test build it lives in the browser (localStorage) and syncs between
// open tabs (BroadcastChannel), so the shop, the customer's "UPI app" and the merchant dashboard
// update live side by side. In production this becomes a database table.
import { useEffect, useState } from "react";
import type { BankConfirmation, LineItem, LogEntry, Merchant, Order, Share } from "./types";

const K = { merchant: "ogt.merchant", orders: "ogt.orders", points: "ogt.points", log: "ogt.log" };
const ORDER_TTL_MIN = 10;

export const DEFAULT_MERCHANT: Merchant = {
  name: "Mane & Oggarane",
  vpa: "maneoggarane@testbank",
  partner: "FITORA Gym",
  mode: "test",
  pgFeePercent: 2,
};

const chan = typeof window !== "undefined" && "BroadcastChannel" in window ? new BroadcastChannel("oggattu") : null;

function read<T>(k: string, d: T): T {
  if (typeof window === "undefined") return d;
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}
function write(k: string, v: unknown) {
  localStorage.setItem(k, JSON.stringify(v));
  chan?.postMessage(k);
  window.dispatchEvent(new Event("ogt-change"));
}

export const getMerchant = () => ({ ...DEFAULT_MERCHANT, ...read<Partial<Merchant>>(K.merchant, {}) });
export const setMerchant = (m: Merchant) => write(K.merchant, m);
export const getOrders = () => read<Order[]>(K.orders, []);
const setOrders = (o: Order[]) => write(K.orders, o);
export const getPoints = () => read<Record<string, number>>(K.points, {});
export const getLog = () => read<LogEntry[]>(K.log, []);

export function log(kind: LogEntry["kind"], text: string) {
  write(K.log, [{ at: new Date().toISOString(), kind, text }, ...getLog()].slice(0, 80));
}

export function resetDemo() {
  for (const k of [K.orders, K.points, K.log]) localStorage.removeItem(k);
  write(K.orders, []);
}

/** Live view of the ledger that re-renders when any tab changes it. */
export function useLedger() {
  const [tick, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("ogt-change", bump);
    window.addEventListener("storage", bump);
    chan?.addEventListener("message", bump);
    const iv = setInterval(() => {
      expireOld();
      bump();
    }, 5000);
    return () => {
      window.removeEventListener("ogt-change", bump);
      window.removeEventListener("storage", bump);
      chan?.removeEventListener("message", bump);
      clearInterval(iv);
    };
  }, []);
  void tick;
  // First render matches the server (empty); browser data appears right after loading.
  if (!mounted) return { merchant: DEFAULT_MERCHANT, orders: [] as Order[], points: {} as Record<string, number>, log: [] as LogEntry[] };
  return { merchant: getMerchant(), orders: getOrders(), points: getPoints(), log: getLog() };
}

// ---------- money helpers (all amounts in paise, never floating rupees) ----------
export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0 })}`;

function code(n = 6) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => a[x % a.length]).join("");
}

/** Splits an amount into n shares that add up exactly (first shares take the extra paise). */
export function splitEvenly(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/** UPI deep link (NPCI format). Any UPI app opens it with the amount and reference filled in. */
export function upiLink(m: Merchant, share: Share, note: string) {
  const p = new URLSearchParams({
    pa: m.vpa,
    pn: m.name,
    am: (share.amount / 100).toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
    tr: share.ref,
  });
  return `upi://pay?${p.toString().replace(/\+/g, "%20")}`;
}

export function createOrder(args: { items: LineItem[]; customer: string; payers: string[]; pointsUsed: number }) {
  const subtotal = args.items.reduce((s, i) => s + i.price * i.qty, 0);
  const pointsUsed = Math.max(0, Math.min(args.pointsUsed, Math.floor((subtotal / 100) * 0.2), getPoints()[key(args.customer)] || 0));
  const total = subtotal - pointsUsed * 100;
  const id = "OGT" + code(5);
  const payers = args.payers.length ? args.payers : [args.customer];
  const amounts = splitEvenly(total, payers.length);
  const now = Date.now();
  const order: Order = {
    id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ORDER_TTL_MIN * 60_000).toISOString(),
    items: args.items,
    subtotal,
    pointsUsed,
    total,
    customer: args.customer,
    together: payers.length > 1,
    shares: payers.map((p, i) => ({ ref: `${id}-${i + 1}`, payer: p, amount: amounts[i], status: "pending" })),
    status: "awaiting",
    kitchenReleased: false,
    pointsEarned: 0,
  };
  if (pointsUsed) {
    const pts = getPoints();
    pts[key(args.customer)] = (pts[key(args.customer)] || 0) - pointsUsed;
    write(K.points, pts);
  }
  setOrders([order, ...getOrders()]);
  log("info", `Order ${id} created: ${rupees(total)}${order.together ? `, split between ${payers.length} people` : ""}`);
  return order;
}

const key = (name: string) => name.trim().toLowerCase();

export function findShare(ref: string) {
  for (const o of getOrders()) {
    const s = o.shares.find((x) => x.ref === ref);
    if (s) return { order: o, share: s };
  }
  return null;
}

function saveOrder(o: Order) {
  setOrders(getOrders().map((x) => (x.id === o.id ? o : x)));
}

function refreshStatus(o: Order) {
  const paid = o.shares.filter((s) => s.status === "paid").length;
  if (paid === o.shares.length) o.status = "paid";
  else if (paid > 0) o.status = "partly-paid";
  if (o.status === "paid" && !o.kitchenReleased) {
    o.kitchenReleased = true;
    // Rewards: 5% back as points, discount-only, can't be bought, sent or cashed out.
    o.pointsEarned = Math.floor((o.total / 100) * 0.05);
    const pts = getPoints();
    pts[key(o.customer)] = (pts[key(o.customer)] || 0) + o.pointsEarned;
    write(K.points, pts);
    log("ok", `Order ${o.id} fully paid: sent to kitchen. ${o.customer} earned ${o.pointsEarned} points.`);
  }
}

function expireOld() {
  const now = Date.now();
  let changed = false;
  const orders = getOrders().map((o) => {
    if (o.status !== "paid" && o.status !== "expired" && new Date(o.expiresAt).getTime() < now) {
      changed = true;
      o.status = "expired";
      o.shares = o.shares.map((s) => (s.status === "pending" ? { ...s, status: "expired" } : s));
    }
    return o;
  });
  if (changed) setOrders(orders);
}

/**
 * Applies a bank confirmation to the ledger. Every check that protects the merchant runs here:
 * bank signature, freshness, amount, unknown reference, expired order, duplicate UTR (idempotency).
 */
export async function applyConfirmation(c: BankConfirmation): Promise<{ ok: boolean; reason: string }> {
  const found = findShare(c.ref);
  if (!found) return block(`Rejected UTR ${c.utr}: unknown reference ${c.ref}`);
  const { order, share } = found;

  const allUtrs = getOrders().flatMap((o) => o.shares.map((s) => s.utr).filter(Boolean));
  if (allUtrs.includes(c.utr)) return block(`Rejected: UTR ${c.utr} was already used. Duplicate/replay blocked, nobody is charged or credited twice.`);
  if (share.status === "paid") return block(`Ignored: ${share.ref} is already paid`);
  if (order.status === "expired") return block(`Rejected: order ${order.id} expired before payment. Refund needed if money arrived.`);

  const r = await fetch("/api/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation: c, expectedAmount: share.amount, expectedRef: share.ref }),
  }).then((x) => x.json());
  if (!r.valid) {
    if (c.status === "FAILURE") {
      share.status = "failed";
      saveOrder(order);
      log("warn", `${share.ref}: bank says payment FAILED. Customer can retry.`);
      return { ok: false, reason: r.reason };
    }
    return block(`Rejected ${share.ref}: ${r.reason}`);
  }

  share.status = "paid";
  share.utr = c.utr;
  share.paidAt = new Date().toISOString();
  share.verifiedBy = "bank-signature";
  refreshStatus(order);
  saveOrder(order);
  log("ok", `${rupees(share.amount)} received from ${share.payer} for ${share.ref} (UTR ${c.utr}, bank-signed)`);
  return { ok: true, reason: "Verified" };
}

/** Pilot mode: real UPI payment, the owner types the UTR from the bank SMS/statement. */
export function confirmByUtr(ref: string, utr: string, amountSeen: number): { ok: boolean; reason: string } {
  const found = findShare(ref);
  if (!found) return block(`Unknown reference ${ref}`);
  const { order, share } = found;
  if (!/^\d{12}$/.test(utr)) return block(`UTR must be 12 digits (got "${utr}")`);
  if (getOrders().some((o) => o.shares.some((s) => s.utr === utr))) return block(`UTR ${utr} already used: duplicate blocked`);
  if (amountSeen !== share.amount) return block(`Amount on bank record ${rupees(amountSeen)} ≠ requested ${rupees(share.amount)}`);
  share.status = "paid";
  share.utr = utr;
  share.paidAt = new Date().toISOString();
  share.verifiedBy = "utr-check";
  refreshStatus(order);
  saveOrder(order);
  log("ok", `${rupees(share.amount)} confirmed by UTR ${utr} for ${share.ref}`);
  return { ok: true, reason: "Confirmed" };
}

function block(text: string) {
  log("block", text);
  return { ok: false, reason: text };
}
