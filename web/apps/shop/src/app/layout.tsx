import type { Metadata, Viewport } from "next";
import { Onest, Outfit } from "next/font/google";
import { GoogleAnalytics } from "@/features/analytics";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], display: "swap" });
const priceFont = Outfit({ variable: "--font-price", subsets: ["latin"], weight: ["300"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Poli Valko: товари для дому, саду та городу",
    template: "%s | Poli Valko",
  },
  description: "Товари для саду, городу й дому з магазину в Бучі: полив, інструмент, садова техніка. Доставка Новою поштою по Україні, самовивіз у Бучі.",
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } : undefined,
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={`${onest.variable} ${priceFont.variable}`}>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Перейти до вмісту
        </a>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
