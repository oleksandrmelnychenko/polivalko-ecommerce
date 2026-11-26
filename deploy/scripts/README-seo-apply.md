# Applying SEO Metadata & Content Hygiene to Production PostgreSQL

This directory contains [`apply-seo-metadata.sql`](apply-seo-metadata.sql) — a single-transaction, idempotent PostgreSQL script that applies the verified SEO metadata, category buying guides, service geo-descriptions, and data hygiene fixes directly to the live `PoliValko` database (`PoliValkoDbContext` / EF Core 11 / PostgreSQL 18).

## What the script updates

| # | Table (`schema.table`) | Columns Updated | Scope |
|---|---|---|---|
| 1 | `catalog.categories` | `seo_title`, `seo_description` | All **89** catalog categories matched by unique `slug` |
| 2 | `catalog.categories` | `description` | **13** priority categories (8 L1 + 5 L2) with plain-text `\n`-separated `'Як обрати'` guides (`<= 2000` chars, matching `CategoryIntro` / `varchar(2000)`) |
| 3 | `content.service_directions` | `description`, `seo_title`, `seo_description`, `updated_at` | All **7** service directions matched by PK `code` (`landscape-design`, `irrigation-installation`, `greening`, `lawns`, `garden-care`, `irrigation-service`, `plant-treatment`) |
| 4 | `content.pages` | `seo_title`, `seo_description`, `updated_at`, `updated_by` | All **4** CMS pages (`payment-delivery`, `returns`, `offer`, `privacy`) |
| 5 | `content.contacts` | `facebook`, `updated_at` | Clears generic root-only placeholder (`https://www.facebook.com` / `https://www.facebook.com/`) to `NULL`; leaves concrete profile URLs untouched |
| 6 | `content.banners` | `image_url`, `updated_at` | Replaces the 3 legacy seeded `images.unsplash.com` URLs with local `/brand/*` assets |
| 7 | `catalog.products`, `catalog.brands` | `brand`, `name`, `normalized_name`, `slug`, `description`, `logo_url` | Normalizes duplicate `Bross` / `Bros` casing to canonical `BROS` safely without violating `ix_brands_normalized_name` or `ix_brands_slug` |

All statements use `IS DISTINCT FROM` guards so re-running the script is a **0-row no-op**.

---

## 1. Take a targeted pre-apply backup (required for instant rollback)

Before applying to production, snapshot the affected tables (fast, takes <1 second):

```bash
export BACKUP_FILE="polivalko-seo-preapply-$(date -u +%Y%m%dT%H%M%SZ).dump"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --data-only \
  --table=catalog.categories \
  --table=catalog.brands \
  --table=catalog.products \
  --table=content.service_directions \
  --table=content.pages \
  --table=content.contacts \
  --table=content.banners \
  --file="$BACKUP_FILE"
```

(If running inside Docker Compose, prefix with `docker compose exec -T database pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" ...`.)

---

## 2. Dry-run preview (read-only / zero permanent changes)

### Option A — Quick read-only inventory & hygiene preview

Check which rows currently need updates before running the script:

```sql
-- Categories missing seo_title / seo_description or rich description
SELECT
    count(*)                                                          AS total_categories,
    count(*) FILTER (WHERE seo_title IS NULL OR btrim(seo_title) = '') AS missing_seo_title,
    count(*) FILTER (WHERE seo_description IS NULL OR btrim(seo_description) = '') AS missing_seo_description,
    count(*) FILTER (WHERE description IS NULL OR btrim(description) = '') AS missing_description
FROM catalog.categories;

-- Service directions current SEO fields
SELECT code, slug, seo_title, seo_description
FROM content.service_directions
ORDER BY sort_order;

-- CMS pages current SEO fields
SELECT slug, seo_title, seo_description
FROM content.pages
ORDER BY slug;

-- Contacts root-only Facebook placeholder check
SELECT id, facebook
FROM content.contacts
WHERE id = 1;

-- Legacy Unsplash banners check
SELECT id, title, image_url
FROM content.banners
WHERE image_url LIKE 'https://images.unsplash.com/%';

-- Duplicate Bross / Bros brand variants check
SELECT brand, count(*) AS products
FROM catalog.products
WHERE brand IS NOT NULL AND upper(btrim(brand)) IN ('BROSS', 'BROS')
GROUP BY brand;

SELECT id, name, normalized_name, slug
FROM catalog.brands
WHERE normalized_name IN ('BROSS', 'BROS');
```

### Option B — Full transactional dry-run (`ROLLBACK` instead of `COMMIT`)

Execute the exact script inside PostgreSQL and replace the final `COMMIT;` with `ROLLBACK;` to see exact `UPDATE`/`DELETE` row counts without mutating any data:

```bash
sed 's/^COMMIT;$/ROLLBACK;/' deploy/scripts/apply-seo-metadata.sql \
  | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --echo-errors
```

Expected output on an unpatched production database:
- Step 1: `UPDATE 89` (or fewer if some categories already match)
- Step 2: `UPDATE 13`
- Step 3: `UPDATE 7`
- Step 4: `UPDATE 4`
- Step 5: `UPDATE 0` or `UPDATE 1`
- Step 6: `UPDATE 0` to `UPDATE 3`
- Step 7: `UPDATE N` (`catalog.products`) + `UPDATE`/`DELETE` (`catalog.brands`)
- Ends with `ROLLBACK` (nothing committed).

---

## 3. Apply in production

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --echo-errors -f deploy/scripts/apply-seo-metadata.sql
```

Or via Docker Compose on the production host:

```bash
docker compose exec -T database psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 --echo-errors < deploy/scripts/apply-seo-metadata.sql
```

Verify idempotency (optional): re-running the script immediately should print `UPDATE 0` / `DELETE 0` for every statement.

### Post-apply cache invalidation

After applying directly in PostgreSQL, clear the Next.js storefront cache (either wait for `stale-while-revalidate`, click a save/revalidate action in the console, or trigger the internal revalidation endpoint with `$REVALIDATE_SECRET` for tags `catalog`, `content`, `site`, `home`).

---

## 4. Rollback

If anything unexpected is observed after applying:

1. Restore the pre-apply snapshot into a staging table or restore the targeted tables directly in a transaction:
   ```bash
   # Clean rollback using the full pre-apply snapshot taken in Step 1:
   # (Run only during maintenance window if live orders/catalog edits occurred after apply;
   #  for surgical rollback without overwriting new products, restore into a temp schema
   #  and UPDATE only seo_title/seo_description/description from the snapshot.)
   pg_restore "$DATABASE_URL" --clean --if-exists --data-only --single-transaction "$BACKUP_FILE"
   ```
2. For zero-downtime surgical rollback of just the SEO columns (preserving any live product stock/price changes since apply), restore `$BACKUP_FILE` into a temporary database `polivalko_rollback_tmp`, export `(slug, seo_title, seo_description, description)` as CSV, and `UPDATE` only those columns back into production.
