import type { Metadata } from "next";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";

const inter = {
  variable: "font-sans",
};

export const metadata: Metadata = {
  title: "AvaClash Chess — Cờ nhanh cùng bạn bè",
  description:
    "Chơi cờ nhanh 5+0 cùng bạn bè, tạo phòng đối kháng hoặc chơi cùng thiết bị. Hỗ trợ Avalanche Fuji và Anvil thử nghiệm.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
