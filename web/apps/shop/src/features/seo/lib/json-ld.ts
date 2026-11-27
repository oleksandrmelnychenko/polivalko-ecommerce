import type { Contacts } from "@polivalko/shared/api/types";
import { directionsUrl } from "@/shared/lib/directions-url";
import { openingHours, specialOpeningHours } from "./opening-hours";
import {
  absoluteUrl,
  organizationId,
  returnPolicyId,
  SITE_ALTERNATE_NAMES,
  SITE_LANGUAGE,
  SITE_NAME,
  siteUrl,
  websiteId,
} from "./site";

const STORE_PHOTO = "/brand/poli-valko-social.png";
const BRAND_LOGO = { path: "/icon.png", width: 192, height: 192 } as const;

const CONTEXT = "https://schema.org";

// The window stated on the «Повернення й обмін» page: 14 days for goods of proper quality.
const RETURN_WINDOW_DAYS = 14;

export const PRICE_VALID_DAYS = 90;

// Verified store location: Буча, вул. Депутатська, 1-В, ТК «Варшавський», фасадний ряд, приміщення №8-12.
const STORE_GEO = {
  "@type": "GeoCoordinates",
  latitude: 50.5450163,
  longitude: 30.1931238,
} as const;

const STORE_PRICE_RANGE = "₴₴";

const LOCAL_SERVICE_AREAS = [
  { "@type": "City", name: "Буча" },
  { "@type": "City", name: "Ірпінь" },
  { "@type": "City", name: "Гостомель" },
  { "@type": "City", name: "Ворзель" },
  { "@type": "City", name: "Вишгород" },
  { "@type": "AdministrativeArea", name: "Київська область" },
] as const;

const STORE_AREA_SERVED = [
  ...LOCAL_SERVICE_AREAS,
  { "@type": "Country", name: "Україна" },
] as const;

const SOCIAL_ROOT_HOSTS = new Set([
  "facebook.com",
  "fb.com",
  "instagram.com",
  "t.me",
  "telegram.me",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "viber.com",
  "x.com",
  "twitter.com",
]);

export type Crumb = { name: string; path?: string };
export type ListEntry = { name: string; path: string; image?: string | null };
export type FaqItem = { question: string; answer: string };
export type ArticleJsonLdInput = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
};
export type ServiceJsonLdInput = {
  name: string;
  description?: string | null;
  path: string;
  image?: string | null;
  serviceType?: string;
  areaServed?: ReadonlyArray<string | { "@type": string; name: string }>;
};
export type OrganizationSource = {
  contacts: Contacts | null;
  seller: { name: string; taxId: string | null; email?: string | null; phone?: string | null } | null;
  sameAs: string[];
};

function phone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

export function isConcreteSocialProfileUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "example.com" || host.endsWith(".example.com")) return false;
    if (SOCIAL_ROOT_HOSTS.has(host)) {
      const path = parsed.pathname.replace(/^\/+|\/+$/g, "");
      if (path.length === 0 && parsed.search.length === 0) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function computePriceValidUntil(referenceDate: Date | string = new Date(), days = PRICE_VALID_DAYS): string {
  const base = typeof referenceDate === "string" ? new Date(referenceDate) : referenceDate;
  const valid = Number.isNaN(base.getTime()) ? new Date() : new Date(base.getTime());
  valid.setUTCDate(valid.getUTCDate() + days);
  return valid.toISOString().slice(0, 10);
}

export function merchantReturnPolicy() {
  return {
    "@type": "MerchantReturnPolicy",
    "@id": returnPolicyId(),
    applicableCountry: "UA",
    returnPolicyCategory: `${CONTEXT}/MerchantReturnFiniteReturnWindow`,
    merchantReturnDays: RETURN_WINDOW_DAYS,
    returnMethod: [`${CONTEXT}/ReturnByMail`, `${CONTEXT}/ReturnInStore`],
    returnFees: `${CONTEXT}/ReturnFeesCustomerResponsibility`,
    merchantReturnLink: absoluteUrl("/returns"),
  };
}

export function productShippingDetails(currency = "UAH") {
  return [
    {
      "@type": "OfferShippingDetails",
      name: "Самовивіз із магазину Poli Valko у Бучі",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: "0",
        currency,
      },
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: "UA",
        addressRegion: "Київська область",
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: 0,
          maxValue: 1,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 0,
          maxValue: 0,
          unitCode: "DAY",
        },
      },
    },
    {
      "@type": "OfferShippingDetails",
      name: "Доставка Новою поштою по Україні (за тарифами перевізника)",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: "80",
        currency,
      },
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: "UA",
      },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: 0,
          maxValue: 1,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 1,
          maxValue: 3,
          unitCode: "DAY",
        },
      },
    },
  ];
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

const WEBSITE_ALTERNATE_NAMES = ["Полі-Валко", "Poli-Valko", "poli-valko.com"] as const;

export function webSiteJsonLd() {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    "@id": websiteId(),
    url: absoluteUrl("/"),
    name: SITE_NAME,
    alternateName: [...WEBSITE_ALTERNATE_NAMES],
    inLanguage: SITE_LANGUAGE,
    publisher: { "@id": organizationId() },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

function postalAddress(value?: string | null) {
  const address = value?.trim();
  if (!address) return undefined;
  // Store settings use a single address line, e.g. "м. Буча, вул. Депутатська, 1-В".
  const parts = /^(?:м\.|с\.|селище\s+)\s*([^,]+),\s*(\S.*)$/iu.exec(address);
  const locality = parts?.[1].trim();
  return {
    "@type": "PostalAddress",
    addressLocality: locality,
    addressRegion: locality && /^буча$/iu.test(locality) ? "Київська область" : undefined,
    streetAddress: parts?.[2] ?? address,
    addressCountry: "UA",
  };
}

function organizationEntity({ contacts, seller, sameAs }: OrganizationSource) {
  const telephone = contacts?.storePhone || seller?.phone || undefined;
  const email = contacts?.email || seller?.email || undefined;
  const hours = openingHours(contacts?.schedule);
  const special = specialOpeningHours(contacts?.specialDays);
  const verifiedSameAs = sameAs.map((url) => url.trim()).filter(isConcreteSocialProfileUrl);
  const points = [
    { contactType: "customer service", telephone: contacts?.storePhone },
    { contactType: "sales", telephone: contacts?.servicesPhone },
  ]
    .filter((point): point is { contactType: string; telephone: string } => Boolean(point.telephone?.trim()))
    .map((point) => ({
      "@type": "ContactPoint",
      contactType: point.contactType,
      telephone: phone(point.telephone),
      areaServed: "UA",
      availableLanguage: ["uk"],
    }));
  const storePhotoUrl = absoluteUrl(STORE_PHOTO);
  const logoObject = {
    "@type": "ImageObject",
    url: absoluteUrl(BRAND_LOGO.path),
    width: BRAND_LOGO.width,
    height: BRAND_LOGO.height,
  };
  return {
    "@type": ["Organization", "Store"],
    "@id": organizationId(),
    name: SITE_NAME,
    alternateName: [...SITE_ALTERNATE_NAMES],
    legalName: seller?.name || undefined,
    url: absoluteUrl("/"),
    // Photo of the shop front in Bucha; the same picture is the site-wide social preview (see metadata.ts).
    image: storePhotoUrl,
    logo: logoObject,
    telephone: telephone ? phone(telephone) : undefined,
    email,
    priceRange: STORE_PRICE_RANGE,
    address: postalAddress(contacts?.address),
    geo: { ...STORE_GEO },
    areaServed: STORE_AREA_SERVED.map((area) => ({ ...area })),
    hasMap: directionsUrl(contacts?.mapUrl, contacts?.address) ?? undefined,
    openingHoursSpecification: hours.length > 0 ? hours : undefined,
    specialOpeningHoursSpecification: special.length > 0 ? special : undefined,
    contactPoint: points.length > 0 ? points : undefined,
    taxID: seller?.taxId || undefined,
    sameAs: verifiedSameAs.length > 0 ? verifiedSameAs : undefined,
    hasMerchantReturnPolicy: merchantReturnPolicy(),
  };
}

export function organizationJsonLd(source: OrganizationSource) {
  return { "@context": CONTEXT, ...organizationEntity(source) };
}

/** A garden service the shop provides; the shop (Organization/Store) is its provider. */
export function serviceJsonLd({ name, description, path, image, serviceType, areaServed }: ServiceJsonLdInput) {
  const url = absoluteUrl(path);
  return {
    "@context": CONTEXT,
    "@type": "Service",
    "@id": `${url}#service`,
    name,
    serviceType: serviceType || name,
    description: description || undefined,
    url,
    image: image ? absoluteUrl(image) : undefined,
    areaServed: areaServed ? [...areaServed] : LOCAL_SERVICE_AREAS.map((area) => ({ ...area })),
    provider: { "@id": organizationId() },
  };
}

export function faqPageJsonLd(items: ReadonlyArray<FaqItem>): Record<string, unknown> {
  const validItems = items
    .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
    .filter((item) => item.question.length > 0 && item.answer.length > 0);
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: validItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function articleJsonLd({
  title,
  description,
  path,
  image,
  datePublished,
  dateModified,
  authorName,
}: ArticleJsonLdInput): Record<string, unknown> {
  const url = absoluteUrl(path);
  const storePhotoUrl = absoluteUrl(STORE_PHOTO);
  const cleanAuthor = authorName?.trim();
  return {
    "@context": CONTEXT,
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    url,
    headline: title.trim(),
    description: description.trim(),
    inLanguage: SITE_LANGUAGE,
    image: [image ? absoluteUrl(image) : storePhotoUrl],
    datePublished: datePublished || undefined,
    dateModified: dateModified || datePublished || undefined,
    author: cleanAuthor
      ? { "@type": "Person", name: cleanAuthor }
      : { "@type": "Organization", "@id": organizationId(), name: SITE_NAME, url: absoluteUrl("/") },
    publisher: {
      "@type": "Organization",
      "@id": organizationId(),
      name: SITE_NAME,
      url: absoluteUrl("/"),
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(BRAND_LOGO.path),
        width: BRAND_LOGO.width,
        height: BRAND_LOGO.height,
      },
    },
    isPartOf: { "@id": websiteId() },
  };
}

export function aboutPageJsonLd({ name, description, path = "/about" }: { name: string; description?: string; path?: string }) {
  const url = absoluteUrl(path);
  return {
    "@context": CONTEXT,
    "@type": "AboutPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description: description?.trim() || undefined,
    inLanguage: SITE_LANGUAGE,
    isPartOf: { "@id": websiteId() },
    mainEntity: { "@id": organizationId() },
  };
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
