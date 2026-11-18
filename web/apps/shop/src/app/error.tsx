"use client";

import { ErrorContent } from "@/features/layout";

export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main">
      <ErrorContent retry={retry} />
    </main>
  );
}
