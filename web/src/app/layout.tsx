import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";

const inter = {
  variable: "font-sans",
};

export const metadata: Metadata = {
  title: "AvaClash Chess — 1v1 Chess with AVAX Wagering",
  description:
    "Play chess 1v1, wager AVAX on Avalanche Fuji testnet. Off-chain gameplay, on-chain settlement with EIP-712 signatures.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
