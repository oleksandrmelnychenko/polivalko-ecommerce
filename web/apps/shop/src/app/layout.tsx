import type { Metadata, Viewport } from "next";
import { Onest, Outfit } from "next/font/google";
import { GoogleAnalytics } from "@/features/analytics";
import { defaultOpenGraph, SITE_NAME, siteUrl } from "@/features/seo";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], display: "swap" });
const priceFont = Outfit({ variable: "--font-price", subsets: ["latin"], weight: ["300"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: "Poli Valko: товари для дому, саду та городу",
    template: `%s | ${SITE_NAME}`,
  },
  description: "Товари для саду, городу й дому з магазину в Бучі: полив, інструмент, садова техніка. Доставка Новою поштою по Україні, самовивіз у Бучі.",
  openGraph: defaultOpenGraph,
  twitter: { card: "summary" },
  formatDetection: { telephone: false, email: false, address: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
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
