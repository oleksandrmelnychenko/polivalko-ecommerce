import type { Metadata, Viewport } from "next";
import { GoogleAnalytics } from "@/features/analytics";
import { defaultOpenGraph, SITE_NAME, siteUrl } from "@/features/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: "Poli Valko: товари для саду, городу й дому",
    template: `%s | ${SITE_NAME}`,
  },
  description: "Товари для саду, городу й дому: полив, інструмент, садова техніка. Доставка Новою поштою по Україні або самовивіз з магазину.",
  openGraph: defaultOpenGraph,
  twitter: { card: "summary", images: defaultOpenGraph.images },
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
    <html lang="uk" data-scroll-behavior="smooth">
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
