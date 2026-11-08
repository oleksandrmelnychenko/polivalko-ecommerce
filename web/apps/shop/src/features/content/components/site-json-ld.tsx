import { JsonLd, organizationJsonLd, webSiteJsonLd } from "@/features/seo";
import { getContacts, getSeller } from "../api/server";
import { organizationSource } from "../lib/organization";

export async function SiteJsonLd() {
  const [contacts, seller] = await Promise.all([getContacts(), getSeller()]);
  return (
    <>
      <JsonLd data={organizationJsonLd(organizationSource(contacts, seller))} />
      <JsonLd data={webSiteJsonLd()} />
    </>
  );
}
