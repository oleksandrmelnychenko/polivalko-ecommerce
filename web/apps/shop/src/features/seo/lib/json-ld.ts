import type { Contacts } from "@polivalko/shared/api/types";
import { openingHours, specialOpeningHours } from "./opening-hours";
import { absoluteUrl, organizationId, SITE_LANGUAGE, SITE_NAME, siteUrl, websiteId } from "./site";

const CONTEXT = "https://schema.org";

export type Crumb = { name: string; path?: string };
export type ListEntry = { name: string; path: string; image?: string | null };
export type OrganizationSource = {
  contacts: Contacts | null;
  seller: { name: string; taxId: string | null; email?: string | null; phone?: string | null } | null;
  sameAs: string[];
};

function phone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function breadcrumbJsonLd(trail: Crumb[]) {
  const items: Crumb[] = [{ name: "Головна", path: "/" }, ...trail];
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.path ? absoluteUrl(crumb.path) : undefined,
    })),
  };
}

export function itemListJsonLd(name: string, entries: ListEntry[], offset = 0) {
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    name,
    numberOfItems: entries.length,
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: offset + index + 1,
      name: entry.name,
      url: absoluteUrl(entry.path),
      image: entry.image ? absoluteUrl(entry.image) : undefined,
    })),
  };
}

export function webSiteJsonLd() {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": websiteId(),
    url: absoluteUrl("/"),
    name: SITE_NAME,
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": organizationId() },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

function organizationEntity({ contacts, seller, sameAs }: OrganizationSource) {
  const telephone = contacts?.storePhone || seller?.phone || undefined;
  const email = contacts?.email || seller?.email || undefined;
  const hours = openingHours(contacts?.schedule);
  const special = specialOpeningHours(contacts?.specialDays);
  const points = [
    { contactType: "customer service", telephone: contacts?.storePhone },
    { contactType: "sales", telephone: contacts?.servicesPhone },
  ]
    .filter((point): point is { contactType: string; telephone: string } => Boolean(point.telephone?.trim()))
    .map((point) => ({ "@type": "ContactPoint", contactType: point.contactType, telephone: phone(point.telephone), areaServed: "UA", availableLanguage: ["uk"] }));
  return {
    "@type": ["Organization", "Store"],
    "@id": organizationId(),
    name: SITE_NAME,
    legalName: seller?.name || undefined,
    url: absoluteUrl("/"),
    telephone: telephone ? phone(telephone) : undefined,
    email,
    address: contacts?.address ? { "@type": "PostalAddress", streetAddress: contacts.address, addressCountry: "UA" } : undefined,
    hasMap: contacts?.mapUrl || undefined,
    openingHoursSpecification: hours.length > 0 ? hours : undefined,
    specialOpeningHoursSpecification: special.length > 0 ? special : undefined,
    contactPoint: points.length > 0 ? points : undefined,
    taxID: seller?.taxId || undefined,
    sameAs: sameAs.length > 0 ? sameAs : undefined,
  };
}

export function organizationJsonLd(source: OrganizationSource) {
  return { "@context": CONTEXT, ...organizationEntity(source) };
}

export function contactPageJsonLd({ name, description, path, organization }: { name: string; description?: string; path: string; organization: OrganizationSource }) {
  const url = absoluteUrl(path);
  return {
    "@context": CONTEXT,
    "@graph": [
      organizationEntity(organization),
      {
        "@type": "ContactPage",
        "@id": `${url}#webpage`,
        url,
        name,
        description,
        inLanguage: SITE_LANGUAGE,
        isPartOf: { "@id": websiteId() },
        mainEntity: { "@id": organizationId() },
      },
    ],
  };
}
