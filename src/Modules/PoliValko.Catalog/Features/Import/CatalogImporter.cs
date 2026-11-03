using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Catalog.Configuration;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Sync;
using PoliValko.Infrastructure.Text;

namespace PoliValko.Catalog.Features.Import;

internal sealed class CatalogImporter(
    PoliValkoDbContext db,
    IOptions<CatalogOptions> options,
    IRichTextSanitizer sanitizer,
    IStorefrontCache storefront,
    TimeProvider time) : ICatalogImporter
{
    private const int BatchSize = 500;

    public async Task<CatalogImportResult> ImportProductsAsync(IReadOnlyList<NavkoloProductRecord> records, CancellationToken ct)
    {
        var errors = new List<SyncError>();
        var valid = ImportValidation.Validate(records, errors);

        var ids = valid.Select(r => r.NavkoloId!).ToList();
        var existing = await db.Set<Product>()
            .Include(p => p.Price)
            .Include(p => p.Stock)
            .Include(p => p.Images)
            .Include(p => p.Attributes)
            .Where(p => ids.Contains(p.NavkoloId))
            .AsSplitQuery()
            .ToDictionaryAsync(p => p.NavkoloId, ct);

        var skus = valid.Select(r => r.Sku!).ToList();
        var skuOwners = await db.Set<Product>()
            .Where(p => skus.Contains(p.Sku))
            .Select(p => new { p.Sku, p.NavkoloId })
            .ToListAsync(ct);
        var categories = await db.Set<Category>().Where(c => c.NavkoloRef != null).ToListAsync(ct);
        var byGroup = categories
            .GroupBy(c => c.NavkoloRef!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.ParentId.HasValue).First(), StringComparer.OrdinalIgnoreCase);
        var slugs = (await db.Set<Product>().Select(p => p.Slug).ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);
        var hidden = options.Value.HiddenNavkoloGroups.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var now = time.GetUtcNow();
        int created = 0, updated = 0, unchanged = 0, pending = 0;

        foreach (var record in valid)
        {
            var label = record.Sku!;
            if (skuOwners.FirstOrDefault(o => o.Sku == record.Sku && o.NavkoloId != record.NavkoloId) is { } owner)
            {
                errors.Add(new SyncError(label, $"Артикул уже належить іншому товару Navkolo ({owner.NavkoloId})."));
                continue;
            }

            var isHidden = hidden.Contains(record.GroupRef!);
            if (!existing.TryGetValue(record.NavkoloId!, out var product))
            {
                if (!byGroup.TryGetValue(record.GroupRef!, out var category))
                {
                    errors.Add(new SyncError(label, $"Невідома група Navkolo «{record.GroupRef}». Зв'яжіть її з розділом сайту в адмінці."));
                    continue;
                }

                product = Create(record, category.Id, ProductFieldWriter.UniqueSlug(record, slugs), !isHidden, now);
                db.Add(product);
                created++;
            }
            else if (ApplyNavkoloFields(product, record, isHidden, now))
            {
                updated++;
            }
            else
            {
                unchanged++;
                continue;
            }

            if (++pending >= BatchSize)
            {
                await db.SaveChangesAsync(ct);
                pending = 0;
            }
        }

        await db.SaveChangesAsync(ct);
        if (created + updated > 0)
        {
            await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Products, StorefrontTags.Collections], ct);
        }

        return new CatalogImportResult(created, updated, unchanged, errors);
    }

    public async Task<CatalogImportResult> ApplyPriceStockAsync(IReadOnlyList<PriceStockRecord> records, CancellationToken ct)
    {
        var errors = new List<SyncError>();
        var ids = records.Select(r => r.NavkoloId).Distinct().ToList();
        var products = await db.Set<Product>()
            .Include(p => p.Price)
            .Include(p => p.Stock)
            .Where(p => ids.Contains(p.NavkoloId))
            .ToDictionaryAsync(p => p.NavkoloId, ct);

        var now = time.GetUtcNow();
        int updated = 0, unchanged = 0;
        foreach (var record in records)
        {
            if (record.Price < 0 || record.Stock < 0)
            {
                errors.Add(new SyncError(record.NavkoloId, "Від'ємна ціна або залишок."));
                continue;
            }

            if (!products.TryGetValue(record.NavkoloId, out var product))
            {
                errors.Add(new SyncError(record.NavkoloId, "Товар ще не імпортовано на сайт."));
                continue;
            }

            var changed = ProductFieldWriter.SetPrice(product, record.Price, record.OldPrice, now) | ProductFieldWriter.SetStock(product, record.Stock, now);
            if (changed)
            {
                updated++;
            }
            else
            {
                unchanged++;
            }
        }

        await db.SaveChangesAsync(ct);
        if (updated > 0)
        {
            await storefront.InvalidateAsync([StorefrontTags.Products, StorefrontTags.Collections], ct);
        }

        return new CatalogImportResult(0, updated, unchanged, errors);
    }

    private Product Create(NavkoloProductRecord record, Guid categoryId, string slug, bool visible, DateTimeOffset now)
    {
        var id = Guid.CreateVersion7(now);
        var product = new Product
        {
            Id = id,
            NavkoloId = record.NavkoloId!,
            Sku = record.Sku!,
            Name = record.Name!,
            NavkoloGroupRef = record.GroupRef,
            VariantGroup = ProductFieldWriter.Clip(record.VariantGroup, 100),
            VariantLabel = ProductFieldWriter.Clip(record.VariantLabel, 100),
            Slug = slug,
            CategoryId = categoryId,
            Brand = ProductFieldWriter.Clip(record.Brand, 200),
            DescriptionHtml = sanitizer.Sanitize(ImportText.TextToHtml(record.Description)),
            IsVisible = visible,
            CreatedAt = now,
            UpdatedAt = now,
            Price = new ProductPrice { ProductId = id, Amount = record.Price!.Value, OldAmount = record.OldPrice, UpdatedAt = now },
            Stock = new ProductStock { ProductId = id, Quantity = record.Stock ?? 0, UpdatedAt = now },
        };
        ProductFieldWriter.FillSiteFields(product, record, now);
        return product;
    }

    private bool ApplyNavkoloFields(Product product, NavkoloProductRecord record, bool hidden, DateTimeOffset now)
    {
        var changed = false;
        changed |= ProductFieldWriter.Set(product.Sku, record.Sku!, v => product.Sku = v);
        changed |= ProductFieldWriter.Set(product.Name, record.Name!, v => product.Name = v);
        changed |= ProductFieldWriter.Set(product.NavkoloGroupRef, record.GroupRef, v => product.NavkoloGroupRef = v);
        changed |= ProductFieldWriter.Set(product.VariantGroup, ProductFieldWriter.Clip(record.VariantGroup, 100), v => product.VariantGroup = v);
        changed |= ProductFieldWriter.Set(product.VariantLabel, ProductFieldWriter.Clip(record.VariantLabel, 100), v => product.VariantLabel = v);
        changed |= ProductFieldWriter.SetPrice(product, record.Price!.Value, record.OldPrice, now);
        changed |= ProductFieldWriter.SetStock(product, record.Stock ?? 0, now);

        if (hidden && product.IsVisible)
        {
            product.IsVisible = false;
            changed = true;
        }

        if (product.Brand is null && ProductFieldWriter.Clip(record.Brand, 200) is { } brand)
        {
            product.Brand = brand;
            changed = true;
        }

        if (product.DescriptionHtml is null && sanitizer.Sanitize(ImportText.TextToHtml(record.Description)) is { } description)
        {
            product.DescriptionHtml = description;
            changed = true;
        }

        changed |= ProductFieldWriter.FillSiteFields(product, record, now);
        return changed;
    }
}
