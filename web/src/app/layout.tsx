import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { GoogleAnalytics } from "@/lib/analytics";
import "./globals.css";

// Основний шрифт за ТЗ (розділ 3) — Onest, змінна вага, з кирилицею.
const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Poli Valko: товари для дому, саду та городу",
    template: "%s | Poli Valko",
  },
  description: "Товари для саду, городу й дому з магазину в Бучі: полив, інструмент, садова техніка. Доставка Новою поштою по Україні, самовивіз у Бучі.",
  // Підтвердження прав на сайт у Search Console (розділ 10 ТЗ).
  verification: process.env.NEXT_PUBLIC_GSC_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } : undefined,
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={onest.variable}>
      <head>
        {/* Тимчасові фото йдуть з Unsplash: з'єднання відкриваємо заздалегідь. */}
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
