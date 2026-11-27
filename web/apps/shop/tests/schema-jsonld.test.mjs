import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadShop as src } from "./helpers/load-ts.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const SITE = "https://www.poli-valko.com";

function withSiteUrl(url, fn) {
  const prev = process.env.SITE_URL;
  process.env.SITE_URL = url;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prev;
  }
}

const liveContacts = {
  address: "м. Буча, вул. Депутатська, 1-В, ТК «Варшавський», фасадний ряд, приміщення №8-12",
  schedule: "Пн–Сб 09:00–18:00, Нд 10:00–17:00",
  storePhone: "+38 (073) 818-52-22",
  servicesPhone: null,
  email: "shop.polivalko@gmail.com",
  mapUrl:
    "https://www.google.com/maps/place/%D0%A1%D0%B0%D0%B4-%D0%93%D0%BE%D1%80%D0%BE%D0%B4-%22Poli-Valko%22/@50.5450175,30.1925813,19z/data=!4m6!3m5!1s0x472b31bc393cca35:0x617da37f05f8dc5d!8m2!3d50.5450163!4d30.1931238!16s%2Fg%2F11h7cwlxj8",
  instagram: "https://www.instagram.com/poli_valko",
  facebook: "https://www.facebook.com",
  telegram: "https://t.me/poliv_poli_valko",
  viber: null,
  youTube: null,
  specialDays: [],
};

const liveSeller = {
  name: "ФОП Валко Віталій",
  taxId: "2386511720",
  email: "shop.polivalko@gmail.com",
  phone: "+38 (073) 818-52-22",
};

const sampleProduct = {
  id: "01a1fea5-0000-7000-8000-000000008326",
  slug: "polyvalnyi-shlanh-green-ats-1-2-50-m-8326",
  sku: "8326",
  name: "Поливальний шланг Cellfast Green ATS 1/2\", 50 м",
  brand: "Cellfast",
  descriptionHtml: "<p>Чотиришаровий садовий шланг із захистом від перекручування.</p>",
  price: { value: "2499.00", currency: "UAH" },
  oldPrice: null,
  inStock: true,
  category: { id: "cat-1", slug: "shlanhy-dlia-polyvu", name: "Шланги для поливу" },
  images: [{ url: "https://cdn.test/hose-1.webp", alt: "Поливальний шланг Cellfast Green ATS" }],
  attributes: [{ name: "Штрихкод", value: "5901828852411" }],
  variants: [],
  seoTitle: "Поливальний шланг Cellfast Green ATS 1/2\", 50 м",
  seoDescription: "Купити шланг для поливу Cellfast у магазині Poli Valko.",
  labels: [],
};

test("returnPolicyId generates stable reusable @id with or without explicit siteUrl", () => {
  const { returnPolicyId } = src("features/seo/lib/site.ts");
  withSiteUrl(SITE, () => {
    assert.equal(returnPolicyId(), `${SITE}/#return-policy`);
    assert.equal(returnPolicyId("https://shop.test/"), "https://shop.test/#return-policy");
  });
});

test("organizationJsonLd unifies brand identity, Bucha geo, areaServed, priceRange, and return policy @id", () => {
  const { organizationJsonLd } = src("features/seo/lib/json-ld.ts");
  const { organizationSource } = src("features/content/lib/organization.ts");
  const { returnPolicyId } = src("features/seo/lib/site.ts");

  withSiteUrl(SITE, () => {
    const source = organizationSource(liveContacts, liveSeller);
    const org = organizationJsonLd(source);

    assert.deepEqual(org["@type"], ["Organization", "Store"]);
    assert.equal(org["@id"], `${SITE}/#organization`);
    assert.equal(org.name, "Poli Valko");
    assert.deepEqual(org.alternateName, ["Poli-Valko", "Полі-Валко"]);
    assert.equal(org.legalName, "ФОП Валко Віталій");
    assert.equal(org.taxID, "2386511720");
    assert.equal(org.telephone, "+380738185222");
    assert.equal(org.email, "shop.polivalko@gmail.com");
    assert.equal(org.priceRange, "₴₴");
    assert.equal(org.image, `${SITE}/brand/poli-valko-social.png`);
    assert.deepEqual(org.logo, { "@type": "ImageObject", url: `${SITE}/brand/poli-valko-social.png` });

    assert.deepEqual(org.geo, {
      "@type": "GeoCoordinates",
      latitude: 50.5450163,
      longitude: 30.1931238,
    });

    assert.equal(org.address.addressLocality, "Буча");
    assert.equal(org.address.addressRegion, "Київська область");
    assert.equal(org.address.addressCountry, "UA");

    const areaNames = org.areaServed.map((area) => area.name);
    for (const expected of ["Буча", "Ірпінь", "Гостомель", "Ворзель", "Вишгород", "Київська область", "Україна"]) {
      assert.ok(areaNames.includes(expected), `areaServed should include ${expected}`);
    }

    // Generic placeholder https://www.facebook.com MUST be excluded from sameAs!
    assert.deepEqual(org.sameAs, [
      "https://www.instagram.com/poli_valko",
      "https://t.me/poliv_poli_valko",
    ]);

    assert.equal(org.hasMerchantReturnPolicy["@id"], returnPolicyId());
    assert.equal(org.hasMerchantReturnPolicy.applicableCountry, "UA");
    assert.equal(org.hasMerchantReturnPolicy.merchantReturnDays, 14);
    assert.equal(org.hasMerchantReturnPolicy.merchantReturnLink, `${SITE}/returns`);
  });
});

test("isConcreteSocialProfileUrl rejects generic social roots and accepts real store profiles", () => {
  const { isConcreteSocialProfileUrl } = src("features/seo/lib/json-ld.ts");

  assert.equal(isConcreteSocialProfileUrl("https://www.facebook.com"), false);
  assert.equal(isConcreteSocialProfileUrl("https://facebook.com/"), false);
  assert.equal(isConcreteSocialProfileUrl("https://www.instagram.com/"), false);
  assert.equal(isConcreteSocialProfileUrl("https://t.me/"), false);
  assert.equal(isConcreteSocialProfileUrl("https://example.com/polivalko"), false);

  assert.equal(isConcreteSocialProfileUrl("https://www.instagram.com/poli_valko"), true);
  assert.equal(isConcreteSocialProfileUrl("https://t.me/poliv_poli_valko"), true);
  assert.equal(isConcreteSocialProfileUrl("https://www.facebook.com/polivalko"), true);
});

test("faqPageJsonLd generates valid FAQPage and drops blank items", () => {
  const { faqPageJsonLd } = src("features/seo/lib/json-ld.ts");
  const faq = faqPageJsonLd([
    { question: "Як знайти потрібний товар?", answer: "Відкрийте потрібний розділ каталогу." },
    { question: "   ", answer: "порожнє питання" },
    { question: "Де розташований магазин?", answer: "м. Буча, вул. Депутатська, 1-В." },
  ]);

  assert.equal(faq["@context"], "https://schema.org");
  assert.equal(faq["@type"], "FAQPage");
  assert.equal(faq.mainEntity.length, 2);
  assert.deepEqual(faq.mainEntity[0], {
    "@type": "Question",
    name: "Як знайти потрібний товар?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Відкрийте потрібний розділ каталогу.",
    },
  });
});

test("HomeFaq renders its answers and structured data from the same questions", () => {
  const homeFaqSource = readFileSync(resolve(here, "../src/features/home/components/home-faq.tsx"), "utf8");
  assert.ok(homeFaqSource.includes('from "@/features/content/server"'));
  assert.ok(!homeFaqSource.includes('from "@/features/seo"'), "home feature must not import seo directly");
  assert.ok(homeFaqSource.includes("<FaqJsonLd"));

  assert.match(homeFaqSource, /<FaqJsonLd items=\{faqItems\}/);
  assert.match(homeFaqSource, /faqItems\.map\(/);
});

test("productJsonLd enriches Offer with shippingDetails, hasMerchantReturnPolicy @id, priceValidUntil (+90d), and no fake ratings", () => {
  const { productJsonLd } = src("features/product/lib/json-ld.ts");
  const { organizationId, returnPolicyId } = src("features/seo/lib/site.ts");

  withSiteUrl(SITE, () => {
    const schema = productJsonLd(sampleProduct, { referenceDate: "2026-11-26T00:00:00Z" });

    assert.equal(schema["@type"], "Product");
    assert.equal(schema.category, "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hoses");
    assert.equal(schema.gtin13, "5901828852411");
    assert.equal(schema.aggregateRating, undefined, "must never emit fake aggregateRating");
    assert.equal(schema.review, undefined, "must never emit fake review");

    const offer = schema.offers;
    assert.equal(offer["@type"], "Offer");
    assert.equal(offer.availability, "https://schema.org/InStock");
    assert.equal(offer.price, "2499.00");
    assert.equal(offer.priceCurrency, "UAH");
    assert.equal(offer.priceValidUntil, "2027-02-24");
    assert.equal(offer.seller["@id"], organizationId());

    assert.equal(offer.hasMerchantReturnPolicy["@type"], "MerchantReturnPolicy");
    assert.equal(offer.hasMerchantReturnPolicy["@id"], returnPolicyId());
    assert.equal(offer.hasMerchantReturnPolicy.applicableCountry, "UA");
    assert.equal(offer.hasMerchantReturnPolicy.merchantReturnDays, 14);

    assert.equal(offer.shippingDetails.length, 2);
    const [pickup, novaPoshta] = offer.shippingDetails;
    assert.equal(pickup["@type"], "OfferShippingDetails");
    assert.equal(pickup.shippingRate.value, "0");
    assert.equal(pickup.shippingRate.currency, "UAH");
    assert.equal(pickup.shippingDestination.addressCountry, "UA");

    assert.equal(novaPoshta["@type"], "OfferShippingDetails");
    assert.equal(novaPoshta.shippingDestination.addressCountry, "UA");
    assert.equal(novaPoshta.deliveryTime.transitTime.unitCode, "DAY");
    assert.equal(novaPoshta.deliveryTime.transitTime.minValue, 1);
    assert.equal(novaPoshta.deliveryTime.transitTime.maxValue, 3);
  });
});

test("productJsonLd handles OutOfStock cleanly and emits aggregateRating/review strictly when real data exists", () => {
  const { productJsonLd } = src("features/product/lib/json-ld.ts");

  withSiteUrl(SITE, () => {
    const outOfStock = productJsonLd(
      { ...sampleProduct, inStock: false },
      { referenceDate: "2026-11-26T00:00:00Z", aggregateRating: { ratingValue: 5, reviewCount: 0 } },
    );
    assert.equal(outOfStock.offers.availability, "https://schema.org/OutOfStock");
    assert.equal(outOfStock.aggregateRating, undefined, "reviewCount=0 must be ignored");

    const noPrice = productJsonLd({ ...sampleProduct, price: { value: "0.00", currency: "UAH" } });
    assert.equal(noPrice.offers, undefined);

    const reviewed = productJsonLd(sampleProduct, {
      priceValidUntil: "2027-02-24",
      aggregateRating: { ratingValue: 4.8, reviewCount: 12 },
      reviews: [{ authorName: "Олександр К.", ratingValue: 5, reviewBody: "Якісний шланг, не перегинається.", datePublished: "2026-10-15" }],
    });
    assert.deepEqual(reviewed.aggregateRating, {
      "@type": "AggregateRating",
      ratingValue: 4.8,
      reviewCount: 12,
      bestRating: 5,
      worstRating: 1,
    });
    assert.equal(reviewed.review.length, 1);
    assert.equal(reviewed.review[0].author.name, "Олександр К.");
  });
});

test("serviceJsonLd includes Kyiv Oblast service areas and organization provider @id", () => {
  const { serviceJsonLd } = src("features/seo/lib/json-ld.ts");
  const { organizationId } = src("features/seo/lib/site.ts");

  withSiteUrl(SITE, () => {
    const svc = serviceJsonLd({
      name: "Монтаж автополиву",
      description: "Проєктування та встановлення автоматичного поливу під ключ.",
      path: "/services/montazh-avtopolyvu",
      image: "/brand/service-irrigation.webp",
    });

    assert.equal(svc["@type"], "Service");
    assert.equal(svc["@id"], `${SITE}/services/montazh-avtopolyvu#service`);
    assert.equal(svc.serviceType, "Монтаж автополиву");
    assert.deepEqual(svc.provider, { "@id": organizationId() });
    const areaNames = svc.areaServed.map((a) => a.name);
    assert.deepEqual(areaNames, ["Буча", "Ірпінь", "Гостомель", "Ворзель", "Вишгород", "Київська область"]);
  });
});

test("articleJsonLd builds Google-compliant BlogPosting with publisher @id and website @id", () => {
  const { articleJsonLd } = src("features/seo/lib/json-ld.ts");
  const { organizationId, websiteId } = src("features/seo/lib/site.ts");

  withSiteUrl(SITE, () => {
    const article = articleJsonLd({
      title: "Як обрати крапельний полив для городу",
      description: "Покроковий гід із вибору крапельної стрічки, фільтра та фітингів для саду й городу.",
      path: "/blog/krapelnyi-polyv-hid",
      image: "/brand/service-irrigation.webp",
      datePublished: "2026-04-12",
      dateModified: "2026-05-01",
    });

    assert.equal(article["@context"], "https://schema.org");
    assert.equal(article["@type"], "BlogPosting");
    assert.equal(article["@id"], `${SITE}/blog/krapelnyi-polyv-hid#article`);
    assert.equal(article.headline, "Як обрати крапельний полив для городу");
    assert.equal(article.inLanguage, "uk-UA");
    assert.deepEqual(article.image, [`${SITE}/brand/service-irrigation.webp`]);
    assert.equal(article.datePublished, "2026-04-12");
    assert.equal(article.dateModified, "2026-05-01");
    assert.equal(article.author["@id"], organizationId());
    assert.equal(article.publisher["@id"], organizationId());
    assert.equal(article.publisher.logo.url, `${SITE}/brand/poli-valko-social.png`);
    assert.deepEqual(article.isPartOf, { "@id": websiteId() });
  });
});

test("aboutPageJsonLd builds valid AboutPage linked to website and organization @id", () => {
  const { aboutPageJsonLd } = src("features/seo/lib/json-ld.ts");
  const { organizationId, websiteId } = src("features/seo/lib/site.ts");

  withSiteUrl(SITE, () => {
    const about = aboutPageJsonLd({
      name: "Про магазин Poli Valko",
      description: "Садовий центр Poli Valko у Бучі (ТК «Варшавський»).",
      path: "/about",
    });

    assert.equal(about["@context"], "https://schema.org");
    assert.equal(about["@type"], "AboutPage");
    assert.equal(about["@id"], `${SITE}/about#webpage`);
    assert.equal(about.url, `${SITE}/about`);
    assert.equal(about.name, "Про магазин Poli Valko");
    assert.equal(about.inLanguage, "uk-UA");
    assert.deepEqual(about.isPartOf, { "@id": websiteId() });
    assert.deepEqual(about.mainEntity, { "@id": organizationId() });
  });
});

test("ServicePageScreen, ServicesScreen, CatalogScreen, AboutScreen, and ContactsScreen wire complete JSON-LD without duplicate ItemList", () => {
  const servicePageSrc = readFileSync(resolve(here, "../src/features/services/components/service-page-screen.tsx"), "utf8");
  assert.ok(servicePageSrc.includes("image: page.imageUrl || group.photo"), "Service JSON-LD must fall back to group.photo when page.imageUrl is null");

  const servicesScreenSrc = readFileSync(resolve(here, "../src/features/services/components/services-screen.tsx"), "utf8");
  assert.ok(servicesScreenSrc.includes("itemListJsonLd("), "/services must emit ItemList JSON-LD for all service directions");

  const catalogScreenSrc = readFileSync(resolve(here, "../src/features/catalog/components/catalog-screen.tsx"), "utf8");
  assert.ok(!catalogScreenSrc.includes("itemListJsonLd"), "/catalog must not emit a duplicate ItemList alongside CatalogListing");

  const aboutScreenSrc = readFileSync(resolve(here, "../src/features/content/components/about-screen.tsx"), "utf8");
  assert.ok(aboutScreenSrc.includes("aboutPageJsonLd("), "/about must emit AboutPage JSON-LD");

  const contactsScreenSrc = readFileSync(resolve(here, "../src/features/content/components/contacts-screen.tsx"), "utf8");
  assert.ok(
    contactsScreenSrc.includes("ТК «Варшавський». Телефон +38 (073) 818-52-22"),
    "/contacts ContactPage.description must match the upgraded meta description",
  );
});

test("googleProductCategory maps store categories to official Google Product Taxonomy strings", () => {
  const { googleProductCategory } = src("features/product/lib/json-ld.ts");

  assert.equal(googleProductCategory({ slug: "vse-dlia-polyvu", name: "Все для поливу" }), "Home & Garden > Lawn & Garden > Watering & Irrigation");
  assert.equal(googleProductCategory({ slug: "shlanhy", name: "Шланги" }), "Home & Garden > Lawn & Garden > Watering & Irrigation > Garden Hoses");
  assert.equal(googleProductCategory({ slug: "doshchuvachi", name: "Дощувачі" }), "Home & Garden > Lawn & Garden > Watering & Irrigation > Sprinklers & Sprinkler Heads");
  assert.equal(googleProductCategory({ slug: "ruchnyi-instrument", name: "Ручний інструмент" }), "Home & Garden > Lawn & Garden > Gardening > Gardening Tools");
  assert.equal(googleProductCategory({ slug: "nasinnia-tomativ", name: "Насіння томатів" }), "Home & Garden > Plants > Seeds");
  assert.equal(googleProductCategory({ slug: "dobryva", name: "Добрива" }), "Home & Garden > Lawn & Garden > Gardening > Fertilizers");
  assert.equal(googleProductCategory({ slug: "shkidnyky", name: "Шкідники" }), "Home & Garden > Household Supplies > Pest Control");
  assert.equal(googleProductCategory({ slug: "vse-dlia-vidpochynku", name: "Все для відпочинку" }), "Home & Garden > Lawn & Garden > Outdoor Living");
  assert.equal(googleProductCategory({ slug: "novyi-rik", name: "Новий рік" }), "Home & Garden > Decor > Seasonal & Holiday Decorations");
  assert.equal(googleProductCategory({ slug: "unknown-slug", name: "Нова категорія" }), "Home & Garden > Lawn & Garden");
});

test("webSiteJsonLd emits Google Site Name fields including Poli Valko and alternate names", () => {
  const { webSiteJsonLd } = src("features/seo/lib/json-ld.ts");

  withSiteUrl(SITE, () => {
    const site = webSiteJsonLd();
    assert.equal(site["@type"], "WebSite");
    assert.equal(site.name, "Poli Valko");
    assert.deepEqual(site.alternateName, ["Полі-Валко", "Poli-Valko", "poli-valko.com"]);
    assert.equal(site.url, `${SITE}/`);
  });
});
