"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { getPage, getPages } from "../api/client";
import { PageEditor } from "./page-editor";

export function PageEditorScreen() {
  const { slug } = useParams<{ slug: string }>();
  const page = useConsoleData(slug, () => getPage(slug));
  const list = useConsoleData("pages", () => getPages());
  const updatedBy = list.data?.find((p) => p.slug === slug)?.updatedBy ?? null;

  return (
    <>
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/content">Сторінки</Link>
          </li>
          <li aria-current="page">{page.data?.title ?? slug}</li>
        </ol>
      </nav>
      <StateBox state={page}>{page.data && <PageEditor key={page.data.slug} initial={page.data} updatedBy={updatedBy} onSaved={page.setData} />}</StateBox>
    </>
  );
}
