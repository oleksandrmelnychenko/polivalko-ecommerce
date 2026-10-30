"use client";

import type { ReactNode } from "react";
import { AdminOnly, ContentNav } from "./_lib";

/** Тексти сайту редагує лише адміністратор; менеджер, що відкрив адресу напряму, бачить пояснення. */
export default function ContentLayout({ children }: { children: ReactNode }) {
  return (
    <AdminOnly title="Контент">
      <ContentNav />
      {children}
    </AdminOnly>
  );
}
