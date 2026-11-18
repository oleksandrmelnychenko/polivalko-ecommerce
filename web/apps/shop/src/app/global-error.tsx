"use client";

import type { CSSProperties } from "react";
import { ErrorContent } from "@/features/layout";
import "./globals.css";

const fonts = { "--font-onest": '"Onest"', "--font-oswald": '"Oswald"' } as CSSProperties;

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="uk" style={fonts}>
      <body>
        <title>Не вдалося завантажити сторінку | Poli Valko</title>
        <main id="main">
          <ErrorContent retry={retry} />
        </main>
      </body>
    </html>
  );
}
