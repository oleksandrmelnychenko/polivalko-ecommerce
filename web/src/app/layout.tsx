import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Montserrat, Roboto, Ubuntu } from "next/font/google";
import { GoogleAnalytics } from "@/lib/analytics";
import "./globals.css";

// Шрифти референсу (тема Sofani): Ubuntu — заголовки, Lato — текст. Lato з Google Fonts не має кирилиці,
// тому текст — власна підмножина Lato 2.015 з кирилицею, перейменована за OFL на «PoliValko Text» (fonts/OFL.txt).
const ubuntu = Ubuntu({ variable: "--font-ubuntu", subsets: ["latin", "cyrillic"], weight: ["400", "500"], display: "swap" });
// Як у референсі: Montserrat — заголовки колонок мегаменю, Roboto — кнопка першого екрана.
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin", "cyrillic"], weight: ["700"], display: "swap" });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin", "cyrillic"], weight: ["500"], display: "swap" });
const text = localFont({
  variable: "--font-text",
  display: "swap",
  src: [
    { path: "./fonts/poli-text-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poli-text-700.woff2", weight: "700", style: "normal" },
  ],
});

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
    <html lang="uk" className={`${ubuntu.variable} ${text.variable} ${montserrat.variable} ${roboto.variable}`}>
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
