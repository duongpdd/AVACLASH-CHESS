import localFont from "next/font/local";
import "./globals.css";
import { Web3Provider } from "@/providers/web3-provider";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { rootMetadata } from "@/lib/metadata";

const beVietnam = localFont({
  src: [
    { path: "../../public/fonts/BeVietnamPro-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/BeVietnamPro-SemiBold.ttf", weight: "600" },
  ],
  variable: "--font-be-vietnam",
  display: "swap",
});

export const generateMetadata = rootMetadata;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={await getLocale()} className="dark">
      <body className={`${beVietnam.variable} font-sans antialiased`}>
        <NextIntlClientProvider>
          <Web3Provider>{children}</Web3Provider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
