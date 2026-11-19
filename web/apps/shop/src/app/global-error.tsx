"use client";

import { ErrorContent } from "@/features/layout";
import "./globals.css";

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="uk">
      <body>
        <title>Не вдалося завантажити сторінку | Poli Valko</title>
        <main id="main">
          <ErrorContent retry={retry} />
        </main>
      </body>
    </html>
  );
}
