"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getMerchant } from "@/lib/store";

const LINKS = [
  { href: "/", label: "How it works" },
  { href: "/shop", label: "Demo shop" },
  { href: "/sim", label: "Test UPI app" },
  { href: "/merchant", label: "Merchant dashboard" },
];

export function Nav() {
  const path = usePathname();
  const [mode, setMode] = useState("test");
  useEffect(() => setMode(getMerchant().mode), [path]);
  return (
    <header className="nav">
      <div className="wrap">
        <Link href="/" className="brand">
          <i>ಒ</i> Oggattu Pay
        </Link>
        <span className={`pill ${mode === "test" ? "test" : "warn"}`}>{mode === "test" ? "TEST MODE · no real money" : "PILOT · real UPI, UTR check"}</span>
        <nav>
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? "on" : ""}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
