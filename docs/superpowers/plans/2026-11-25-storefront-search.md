# Storefront Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search that tolerates word forms, synonyms, Russian, wrong keyboard layout and typos, ranks by relevance, and shows live results on `/search` instead of a dropdown.

**Architecture:** An in-memory text matcher (`SearchIndex`) scores non-archived products loaded per request (id, names, brand, slug, sku, category); SQL keeps visibility, filters, facets and pricing and receives the matching ids plus a relevance tier for ordering. The shop header navigates to `/search?q=` while typing.

**Tech Stack:** ASP.NET Core / EF Core / PostgreSQL; Next.js App Router.

**Spec:** `docs/superpowers/specs/2026-11-25-storefront-search-design.md`

## Global Constraints

- No new fields in API responses; `openapi/` and `schema.d.ts` stay unchanged.
- Explicit price/name sorts keep their order; relevance leads only for the default (seasonal / stock_cover) modes.
- The seven existing `ProductSearchApiTests` stay green.

## Review Focus

- Query of stop-words only («для») → treated like empty words: nothing, not the whole catalog.
- Latin brand query (`gardena`) must not be layout-converted when it matches.
- SKU typed with dashes/letters (`DEMO-001`) still found exactly and first.
- Typing fast on `/search` must not remount the input or lose characters.
- Back button after live search returns to the page the user came from.

---

### Task 1: Matcher (`ProductSearchText` rewrite)

**Files:** Modify `src/Modules/PoliValko.Catalog/Features/Storefront/ProductSearchText.cs`; Create `.../Storefront/SearchVocabulary.cs` (stop-words, synonyms, layout map); Test `tests/PoliValko.UnitTests/Catalog/ProductSearchTextTests.cs`.

**Produces:** `ProductSearchText.Rank(string term, IReadOnlyList<SearchEntry> entries, IReadOnlyList<Category> categories) -> SearchRanking(IReadOnlyList<(Guid Id, int Score)> Hits, bool Approximate)`; `record SearchEntry(Guid Id, string Name, string? DisplayName, string? Brand, string Slug, string Sku, Guid CategoryId)`.

- [ ] Unit tests: stop-words dropped; `удобрение`→matches «Добриво»; `ufpjy`→«газон»; `насіння томату` matches «Томат X Seedera» in category «Насіння»; name match scores above category-only match; typo `секатри` approximate; nonsense empty and not approximate.
- [ ] Implement; run unit tests via `deploy/compose.tests.yaml`.

### Task 2: Wire into `SearchProducts` + relevance order

**Files:** Modify `SearchProducts.cs`, `SeasonalMerchandising.cs` (optional `Guid[][] relevanceTiers` leading key after SKU); Test `tests/PoliValko.IntegrationTests/Catalog/ProductSearchApiTests.cs`.

- [ ] Integration tests: category word finds product; Russian synonym; wrong layout; name match ranked before category-only match.
- [ ] Implement; full backend tests green.

### Task 3: Live results on `/search`

**Files:** Modify `web/apps/shop/src/features/search/components/search-button.tsx`, header CSS (remove `.search-suggestions`).

- [ ] Debounced 300 ms `router.push` (first) / `router.replace` (later) to `/search?q=`; no keyed remount; adopt URL `q` on back/forward only.
- [ ] `npm run lint`, `typecheck`, `build`; verify in Browser pane.

### Task 4: Quality pass on production copy

- [ ] Run ~20 real queries against `pv-prodcopy` data and fix ranking/vocabulary gaps.
