import { connection } from "next/server";
import { JsonLd, organizationJsonLd, webSiteJsonLd } from "@/features/seo";
import { getContacts, getSeller } from "../api/server";
import { organizationSource } from "../lib/organization";

export async function SiteJsonLd() {
  await connection();
  const [contacts, seller] = await Promise.all([getContacts().catch(() => null), getSeller().catch(() => null)]);
  return (
    <>
      <JsonLd data={organizationJsonLd(organizationSource(contacts, seller))} />
      <JsonLd data={webSiteJsonLd()} />
    </>
  );
}
