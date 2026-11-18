"use client";

import { ErrorContent } from "@/features/layout";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorContent retry={retry} />;
}
