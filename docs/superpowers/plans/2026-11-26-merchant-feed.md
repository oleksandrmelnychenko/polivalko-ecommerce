# Merchant Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A product feed at `/feeds/google-merchant.xml` that Google Merchant Center fetches daily, plus the 14-day return policy in the shop's Organization markup.

**Architecture:** The API returns the feed's products in one JSON list (`GET /api/v1/catalog/merchant-feed`, same shape of query as the sitemap endpoint). The storefront loads it with the cached API client and a pure function turns it into RSS 2.0 XML with the `g:` namespace; a route handler serves the result.

**Tech Stack:** ASP.NET Core / EF Core / PostgreSQL; Next.js App Router; node:test.

**Spec:** `docs/superpowers/specs/2026-11-26-merchant-feed-design.md`

## Global Constraints

- In the feed: visible products with a price above zero and at least one photo; sold-out ones stay with `out_of_stock`.
- Currency `UAH`, condition `new`, title at most 150 characters, description at most 5,000, at most 10 additional images.
- `g:id` is the article number (SKU); when a SKU repeats inside the feed, the product with the smallest id keeps it and the others use their product id, so ids do not move with sort order.
- `g:identifier_exists` is `no` only for a product with no brand, no GTIN and no manufacturer model; a branded product never gets it (Google allows `no` only when no identifier was ever assigned).
- No shipping, no `google_product_category`, no `item_group_id` in the feed.
- The new endpoint changes the API contract: `openapi/polivalko-api.json` and `web/packages/shared/api/schema.d.ts` are regenerated, never edited by hand.
- Details of the hosting setup stay out of code comments and docs (the repository is public).

## Review Focus

- A name or description with XML special characters (`Шланг 1/2"`, `&`, `<`) must come out escaped, and the file must parse as XML.
- A failed API call, or an answer with zero items, must not produce an empty feed with status 200: Merchant Center would drop every product. The route answers 500 in both cases.
- A control character in a name or description breaks the whole file: they are stripped.
- The barcode attribute sometimes holds the shop's own article number or an in-store code: only a real GTIN goes into `g:gtin`.
- A product with no description, or one made only of tags, gets its title as the description.
- A branded product without a GTIN gets no `g:identifier_exists` at all.

---

### Task 1: API endpoint and contract

**Files:**
- Create: `src/Modules/PoliValko.Catalog/Features/Storefront/GetMerchantFeed.cs`
- Modify: `src/Modules/PoliValko.Catalog/Features/Storefront/StorefrontDtos.cs` (new record), `src/Modules/PoliValko.Catalog/Features/Storefront/CatalogEndpoints.cs` (mapping after `/catalog/sitemap`)
- Regenerate: `openapi/polivalko-api.json`, `web/packages/shared/api/schema.d.ts`
- Modify: `web/packages/shared/api/types.ts` (alias)
- Test: `tests/PoliValko.IntegrationTests/Catalog/StorefrontSeoApiTests.cs`

**Interfaces:**
- Produces: `GET /api/v1/catalog/merchant-feed` (operation `GetMerchantFeed`) returning `MerchantFeedItemDto[]` ordered by slug:
  `MerchantFeedItemDto(Guid Id, string Slug, string Sku, string Name, string? Brand, string? DescriptionHtml, MoneyDto Price, MoneyDto? OldPrice, bool InStock, IReadOnlyList<string> CategoryPath, IReadOnlyList<string> Images, IReadOnlyList<ProductAttributeDto> Attributes)`.
  `CategoryPath` runs from the top department to the product's own category; `Images` are URLs in display order; `Name` is `DisplayName ?? Name`.
- Produces: `export type MerchantFeedItem = S["MerchantFeedItemDto"]` in `web/packages/shared/api/types.ts`.

- [ ] **Step 1: Write the failing test** `Merchant_feed_lists_priced_products_with_a_photo_and_what_the_feed_needs`:
  four products in `hospodarchi-tovary` (priced with photo in stock; priced with photo sold out; price 0 with photo; priced without photo); one barcode attribute `4823067702320` and brand on the first. Assert: the first two slugs are present and the last two absent; for the first: `Sku`, `Price.Value == "120.00"`, `InStock`, `Images` holds its photo URL, `CategoryPath.Last()` equals the category name read from the database, `Attributes` holds the barcode; for the sold-out one `InStock` is false.
- [ ] **Step 2: Run the class in Docker and watch it fail** (404 from the endpoint).
- [ ] **Step 3: Implement** `GetMerchantFeed.HandleAsync(PoliValkoDbContext db, CancellationToken ct)`: `CatalogVisibility.ProductsAsync`, `IsVisible`, `Price.Amount > 0`, `Images.Any()`, split query for images and attributes, category path from `CategoryQueries.LoadVisibleCategoriesAsync` by `ParentId`; `ProductListing.IsPurchasable` and `ProductListing.OldPrice` for stock and old price. Map it with `.WithName("GetMerchantFeed")`.
- [ ] **Step 4: Run the whole backend suite in Docker**, copy the generated `openapi/polivalko-api.json` out of the container, run `npm run api:types`, add the alias.
- [ ] **Step 5: Commit** the endpoint, the test and the regenerated contract together.

### Task 2: Feed XML builder

**Files:**
- Create: `web/apps/shop/src/features/catalog/lib/merchant-feed.ts`
- Test: `web/apps/shop/tests/merchant-feed.test.mjs`

**Interfaces:**
- Consumes: `MerchantFeedItem` (Task 1), `gtinFromAttributes` from `@polivalko/shared/lib/gtin`, `plainText` from `@polivalko/shared/lib/format`.
- Produces: `merchantFeedXml(items: readonly MerchantFeedItem[], shop: { url: string; name: string; description: string }): string`.

- [ ] **Step 1: Write the failing tests** (literal expected fragments):
  - a full product: `<g:id>8326</g:id>`, title, description from two paragraphs joined by a space, `<link>https://shop.test/product/<slug></link>`, `<g:image_link>` plus one `<g:additional_image_link>`, `<g:availability>in_stock</g:availability>`, `<g:price>2499.00 UAH</g:price>`, `<g:brand>`, `<g:gtin>5901828852411</g:gtin>`, `<g:mpn>` from «Модель виробника», `<g:product_type>Все для поливу &gt; Шланги</g:product_type>`, `<g:condition>new</g:condition>`, and no `g:identifier_exists`;
  - sold out: `out_of_stock`;
  - old price 300 and price 250: `<g:price>300.00 UAH</g:price>` and `<g:sale_price>250.00 UAH</g:sale_price>`;
  - no brand, barcode `12254` (an article number): no `g:gtin`, no `g:brand`, `<g:identifier_exists>no</g:identifier_exists>`;
  - brand without GTIN or model: no `g:identifier_exists`; no brand but a model: no `g:identifier_exists`, `g:mpn` present;
  - a name with the control character U+0007: stripped;
  - an empty list: the builder throws;
  - name `Шланг 1/2" & <муфта>`: escaped in `<title>`; the whole document starts with the XML declaration and declares `xmlns:g="http://base.google.com/ns/1.0"`;
  - no description (null, and `<p> </p>`): description equals the title;
  - a description of 6,000 characters: at most 5,000 in the feed, ending with `…`;
  - 14 images: one `g:image_link` and exactly 10 `g:additional_image_link`;
  - two items with SKU `7000` given in either order: the one with the smaller product id keeps `7000`, the other gets its product id.
- [ ] **Step 2: Run** `node --test apps/shop/tests/merchant-feed.test.mjs` from `web` and watch them fail (module missing).
- [ ] **Step 3: Implement** the builder; reuse `clip` from `features/product/lib/description.ts` only if the import boundary allows it, otherwise keep a local word-boundary cut.
- [ ] **Step 4: Run all storefront tests**: `node --test apps/shop/tests/*.test.mjs`.
- [ ] **Step 5: Commit.**

### Task 3: Route, loader, checks and docs

**Files:**
- Create: `web/apps/shop/src/app/feeds/google-merchant.xml/route.ts`
- Modify: `web/apps/shop/src/features/catalog/api/server.ts` (`getMerchantFeed`), `web/apps/shop/src/features/catalog/server.ts` and `index.ts` (exports), `tests/seo/check-seo.mjs`, `docs/SEO.md`

**Interfaces:**
- Consumes: `merchantFeedXml` (Task 2), `GET /api/v1/catalog/merchant-feed` (Task 1).
- Produces: `getMerchantFeed(): Promise<MerchantFeedItem[]>` cached for hours under the tags `catalog`, `products`, `categories`; it throws when the API does not answer. `GET /feeds/google-merchant.xml` answers `application/xml; charset=utf-8`.

- [ ] **Step 1: Extend `tests/seo/check-seo.mjs`**: the feed answers 200 with an XML content type, parses into at least one `<item>`, and every sampled item has `g:id`, `title`, `link`, `g:image_link`, `g:price`, `g:availability`.
- [ ] **Step 2: Run the script against production** and watch the new checks fail (404).
- [ ] **Step 3: Implement** the loader and the route (`await connection()`, then the loader; no catch around it).
- [ ] **Step 4: Verify on a local production build** with a stand-in API that serves real catalog data: the script passes; with the stand-in's feed endpoint failing the route answers 500, not an empty feed.
- [ ] **Step 5: Document** the feed in `docs/SEO.md` and commit.

### Task 4: Return policy in the Organization markup

**Files:**
- Modify: `web/apps/shop/src/features/seo/lib/json-ld.ts`
- Test: `web/apps/shop/tests/seo-indexing.test.mjs`

**Interfaces:**
- Produces: `organizationJsonLd(...)` gains `hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "UA", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: 14 }`.

- [ ] **Step 1: Write the failing test** asserting exactly that object on `organizationJsonLd({ contacts: null, seller: null, sameAs: [] })`.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Implement** with a named constant for the 14 days and a comment pointing at the returns page.
- [ ] **Step 4: Run all storefront tests, lint, typecheck and build.**
- [ ] **Step 5: Commit.**
