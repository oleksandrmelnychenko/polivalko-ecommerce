-- =============================================================================
-- Poli Valko — Idempotent Follow-Up Production SEO Hygiene Script (Neon Safe)
-- =============================================================================
-- Target schema: EF Core 11 / PostgreSQL 18 (PoliValkoDbContext)
--   1. Replace remaining legacy images.unsplash.com banner URL
--      (id = 01a1c18c-11dd-76f3-b89e-1fdeae136094 and any remaining Unsplash URLs)
--      with local /brand/service-irrigation.webp.
--   2. Normalize remaining "Bross" product names (whole-word match) to "BROS"
--      across catalog.products (name, display_name, seo_title, seo_description).
--
-- Safety:
--   * Wrapped in a single transaction (BEGIN ... COMMIT).
--   * Zero semicolons inside string literals (safe for Neon Console SQL Editor).
--   * 100% idempotent (re-running updates 0 rows).
-- =============================================================================

BEGIN;

-- 1. Replace remaining Unsplash banner image(s) with local first-party asset
UPDATE content.banners
SET image_url = '/brand/service-irrigation.webp',
    updated_at = now()
WHERE (id = '01a1c18c-11dd-76f3-b89e-1fdeae136094'::uuid
       OR image_url LIKE '%images.unsplash.com%')
  AND image_url IS DISTINCT FROM '/brand/service-irrigation.webp';

UPDATE content.banners
SET mobile_image_url = '/brand/service-irrigation.webp',
    updated_at = now()
WHERE mobile_image_url LIKE '%images.unsplash.com%';

-- 2. Normalize "Bross" -> "BROS" in product titles & SEO fields (whole-word match)
UPDATE catalog.products
SET name = regexp_replace(name, '\mBross\M', 'BROS', 'gi'),
    display_name = CASE
        WHEN display_name IS NOT NULL THEN regexp_replace(display_name, '\mBross\M', 'BROS', 'gi')
        ELSE NULL
    END,
    seo_title = CASE
        WHEN seo_title IS NOT NULL THEN regexp_replace(seo_title, '\mBross\M', 'BROS', 'gi')
        ELSE NULL
    END,
    seo_description = CASE
        WHEN seo_description IS NOT NULL THEN regexp_replace(seo_description, '\mBross\M', 'BROS', 'gi')
        ELSE NULL
    END,
    updated_at = now()
WHERE name ~* '\mBross\M'
   OR (display_name IS NOT NULL AND display_name ~* '\mBross\M')
   OR (seo_title IS NOT NULL AND seo_title ~* '\mBross\M')
   OR (seo_description IS NOT NULL AND seo_description ~* '\mBross\M');

COMMIT;
