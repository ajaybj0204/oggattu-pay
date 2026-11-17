import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Oggattu Pay: zero-fee, pay-together UPI for local businesses",
  description: "Oggattu Pay (ಒಗ್ಗಟ್ಟು = togetherness): direct UPI to the merchant's bank with zero fees, group split payments, neighbourhood rewards and bank-verified confirmations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
