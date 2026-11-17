import Link from "next/link";

const FLOW = [
  { t: "Order", d: "Customer orders at the shop's own website. Oggattu creates a payment request with a unique reference (e.g. OGT7K2P-1)." },
  { t: "UPI link / QR", d: "A standard NPCI UPI link (upi://pay) with the merchant's own UPI ID, exact amount and reference. Opens in any UPI app." },
  { t: "Customer pays", d: "Money goes bank → bank straight to the merchant over UPI. Oggattu never holds the money, so 0% fee." },
  { t: "Bank confirms", d: "The bank's signed confirmation (UTR + amount + reference) is verified: signature, freshness, amount, duplicate UTR." },
  { t: "Kitchen + rewards", d: "Only after verification: order goes to the kitchen, points are earned, voice receipt plays, books reconcile." },
];

const COMPARE: [string, string, string, string, string][] = [
  ["", "PhonePe / GPay / Paytm", "Razorpay / Cashfree", "YouPI PG (open source)", "Oggattu Pay"],
  ["Who it serves", "Consumers (the payer app)", "Merchants, via a gateway", "Merchants, self-hosted", "Small local merchants + their customers"],
  ["Merchant fee on UPI", "0% (direct QR)", "Gateway fee per txn", "0%", "0%: direct UPI to merchant"],
  ["Holds the money?", "Payer's bank", "Yes, settles later (T+1/T+2)", "No", "No, instant to merchant's bank"],
  ["Group split at checkout", "Split after, in app", "No", "No", "Yes: Pay Together, kitchen waits for all"],
  ["Rewards across nearby shops", "App cashback", "No", "No", "Yes: neighbourhood points (discount-only)"],
  ["Payment confirmation", "Bank", "Gateway webhook", "Parses bank SMS / Gmail", "Bank-signed callback (+ UTR check in pilot)"],
  ["Fake screenshot / replay safe", "n/a", "Yes", "Partly", "Yes: signature, UTR dedupe, amount, expiry"],
  ["Regional voice receipts", "Soundbox (paid device)", "No", "No", "Yes, on any phone (Kannada/English)"],
];

export default function Home() {
  return (
    <main className="wrap">
      <section className="hero">
        <span className="pill test">Built by Ajay B J · test-mode prototype</span>
        <h1>
          Oggattu Pay <span className="kn">ಒಗ್ಗಟ್ಟು</span>
          <br />
          zero-fee, pay-together UPI for local businesses.
        </h1>
        <p>
          Customers pay by UPI <b>straight into the shop&apos;s bank</b>, so the merchant keeps 100%. Friends can <b>pay together</b>{" "}
          with one link each, nearby shops share <b>rewards</b>, and every payment is <b>bank-verified</b>: no fake screenshots,
          no double credit.
        </p>
        <div className="row">
          <Link className="btn go" href="/shop">Try the demo shop →</Link>
          <Link className="btn" href="/merchant">Open merchant dashboard</Link>
          <Link className="btn" href="/sim">Test UPI app + fraud lab</Link>
        </div>
      </section>

      <section className="card">
        <h2>How a payment flows</h2>
        <div className="flow">
          {FLOW.map((f) => (
            <div key={f.t}>
              <b>{f.t}</b>
              {f.d}
            </div>
          ))}
        </div>
      </section>

      <section className="grid g4" style={{ marginTop: 14 }}>
        {[
          ["0% fee", "UPI goes direct to the merchant's bank. Nothing is deducted, settlement is instant."],
          ["Pay Together", "Split one bill into a UPI link per friend. The order starts only when everyone has paid."],
          ["Neighbourhood rewards", "5% back as points, usable at partner shops. Discount-only, so not a wallet."],
          ["Can't be faked", "Bank-signed confirmations, UTR de-duplication, amount and expiry checks, a fraud lab to prove it."],
        ].map(([t, d]) => (
          <div className="card" key={t}>
            <h3 style={{ color: "var(--saffron)" }}>{t}</h3>
            <p className="muted small" style={{ margin: 0 }}>{d}</p>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginTop: 14, overflowX: "auto" }}>
        <h2>How it&apos;s different</h2>
        <table>
          <tbody>
            {COMPARE.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) =>
                  i === 0 ? <th key={j} style={j === 4 ? { color: "var(--saffron)" } : undefined}>{c}</th> : <td key={j} style={j === 0 ? { color: "var(--muted)" } : j === 4 ? { color: "var(--ink)", fontWeight: 600 } : undefined}>{c}</td>,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h2>Why no RBI licence is needed</h2>
          <p className="muted small">
            Oggattu Pay never receives or holds customer money. It creates standard UPI payment requests to the merchant&apos;s own
            UPI ID and records the bank&apos;s confirmation. Payment aggregators that collect and later settle funds need RBI PA
            authorisation; this design avoids that. Reward points are earned only, discount-only and non-transferable, so they
            are not a prepaid wallet (PPI).
          </p>
        </div>
        <div className="card">
          <h2>Roll-out stages</h2>
          <p className="muted small" style={{ margin: 0 }}>
            <b>1. Test mode (this demo):</b> simulated bank with signed confirmations.
            <br />
            <b>2. Pilot:</b> real UPI to the shop&apos;s UPI ID, owner confirms with the UTR from the bank record.
            <br />
            <b>3. Production:</b> the bank&apos;s business UPI collect API sends signed callbacks automatically.
          </p>
        </div>
      </section>
    </main>
  );
}
