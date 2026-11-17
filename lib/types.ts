// Oggattu Pay: shared types.

export type Mode = "test" | "pilot"; // test = simulated bank; pilot = real UPI, confirm by UTR

export type Merchant = {
  name: string;
  vpa: string; // merchant's own UPI ID, money goes straight here
  partner: string; // neighbourhood partner shop where rewards can also be used
  mode: Mode;
  pgFeePercent: number; // what a gateway would charge, for the "fees saved" report
};

export type LineItem = { id: string; name: string; price: number; qty: number };

/** One payment request. A normal order has 1 share; a Pay Together order has one per person. */
export type Share = {
  ref: string; // e.g. OGT7K2P-1, goes in the UPI "tr" field so the payment can be matched
  payer: string;
  amount: number; // paise
  status: "pending" | "paid" | "failed" | "expired";
  utr?: string; // bank's unique reference for the payment
  paidAt?: string;
  verifiedBy?: "bank-signature" | "utr-check";
};

export type Order = {
  id: string;
  createdAt: string;
  expiresAt: string;
  items: LineItem[];
  subtotal: number; // paise
  pointsUsed: number; // reward points redeemed (1 point = ₹1 discount)
  total: number; // paise, after discount
  customer: string;
  together: boolean;
  shares: Share[];
  status: "awaiting" | "partly-paid" | "paid" | "expired" | "failed";
  kitchenReleased: boolean;
  pointsEarned: number;
};

/** A confirmation as a bank would send it, signed so it can't be faked. */
export type BankConfirmation = {
  ref: string;
  amount: number; // paise
  utr: string;
  status: "SUCCESS" | "FAILURE";
  payerVpa: string;
  ts: number;
  sig: string;
};

export type LogEntry = { at: string; kind: "ok" | "warn" | "block" | "info"; text: string };
