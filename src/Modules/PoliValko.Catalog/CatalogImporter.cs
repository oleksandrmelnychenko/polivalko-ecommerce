using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PoliValko.Catalog.Api;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog;

/// <summary>Товар у форматі обміну з Navkolo: файл первинного імпорту або відповідь API.</summary>
public sealed record NavkoloProductRecord(
    string? NavkoloId,
    string? Sku,
    string? Name,
    string? GroupRef,
    decimal? Price,
    decimal? OldPrice,
    decimal? Stock,
    string? Brand = null,
    string? VariantGroup = null,
    string? VariantLabel = null,
    string? Description = null,
    IReadOnlyList<ProductAttributeDto>? Attributes = null,
    IReadOnlyList<string>? ImageUrls = null);

/// <summary>Інкрементальне оновлення ціни й залишку (кожні 5 хв).</summary>
public sealed record PriceStockRecord(string NavkoloId, decimal Price, decimal? OldPrice, decimal Stock);

public sealed record CatalogImportResult(int Created, int Updated, int Unchanged, IReadOnlyList<SyncError> Errors)
{
    public string Summary => $"Нових: {Created}, оновлено: {Updated}, без змін: {Unchanged}, помилок: {Errors.Count}";
}

public sealed class CatalogOptions
{
    /// <summary>Групи Navkolo, товари яких імпортуються прихованими (розділ 4 ТЗ: «Хлам»).</summary>
    public List<string> HiddenNavkoloGroups { get; set; } = ["Хлам"];
}

/// <summary>
/// Імпорт каталогу з Navkolo з перевіркою формату, обов'язкових полів, дублікатів і категорій (розділ 7 ТЗ).
/// Перезаписує лише поля Navkolo; дані сайту заповнює тільки для нових товарів або порожніх полів.
/// </summary>
public interface ICatalogImporter
{
    Task<CatalogImportResult> ImportProductsAsync(IReadOnlyList<NavkoloProductRecord> records, CancellationToken ct);

    Task<CatalogImportResult> ApplyPriceStockAsync(IReadOnlyList<PriceStockRecord> records, CancellationToken ct);
}

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
        var valid = Validate(records, errors);

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

                product = Create(record, category.Id, UniqueSlug(record, slugs), !isHidden, now);
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

            var changed = SetPrice(product, record.Price, record.OldPrice, now) | SetStock(product, record.Stock, now);
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

    private static List<NavkoloProductRecord> Validate(IReadOnlyList<NavkoloProductRecord> records, List<SyncError> errors)
    {
        var valid = new List<NavkoloProductRecord>(records.Count);
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var skus = new Dictionary<string, string>(StringComparer.Ordinal);

        for (var i = 0; i < records.Count; i++)
        {
            var r = records[i] with
            {
                NavkoloId = TrimOrNull(records[i].NavkoloId),
                Sku = TrimOrNull(records[i].Sku),
                Name = TrimOrNull(records[i].Name),
                GroupRef = TrimOrNull(records[i].GroupRef),
            };
            var label = r.Sku ?? r.NavkoloId ?? $"рядок {i + 1}";
            var problem = r switch
            {
                { NavkoloId: null } => "Немає ідентифікатора Navkolo.",
                { Sku: null } => "Немає артикула.",
                { Name: null } => "Немає назви.",
                { GroupRef: null } => "Немає групи товарів.",
                { Price: null or < 0m } => "Ціна має бути невід'ємним числом.",
                { Stock: < 0m } => "Залишок не може бути від'ємним.",
                { NavkoloId.Length: > 100 } or { Sku.Length: > 100 } or { GroupRef.Length: > 100 } => "Ідентифікатор, артикул або група довші за 100 символів.",
                { Name.Length: > 500 } => "Назва довша за 500 символів.",
                _ when !ids.Add(r.NavkoloId!) => "Дублікат ідентифікатора Navkolo у файлі.",
                _ when skus.TryGetValue(r.Sku!, out var other) && other != r.NavkoloId => "Дублікат артикула у файлі.",
                _ => null,
            };

            if (problem is not null)
            {
                errors.Add(new SyncError(label, problem));
                continue;
            }

            skus[r.Sku!] = r.NavkoloId!;
            valid.Add(r);
        }

        return valid;

        static string? TrimOrNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
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
            VariantGroup = Clip(record.VariantGroup, 100),
            VariantLabel = Clip(record.VariantLabel, 100),
            Slug = slug,
            CategoryId = categoryId,
            Brand = Clip(record.Brand, 200),
            DescriptionHtml = sanitizer.Sanitize(TextToHtml(record.Description)),
            IsVisible = visible,
            CreatedAt = now,
            UpdatedAt = now,
            Price = new ProductPrice { ProductId = id, Amount = record.Price!.Value, OldAmount = record.OldPrice, UpdatedAt = now },
            Stock = new ProductStock { ProductId = id, Quantity = record.Stock ?? 0, UpdatedAt = now },
        };
        FillSiteFields(product, record, now);
        return product;
    }

    /// <summary>Поля Navkolo перезаписуються; поля сайту заповнюються лише тоді, коли порожні.</summary>
    private bool ApplyNavkoloFields(Product product, NavkoloProductRecord record, bool hidden, DateTimeOffset now)
    {
        var changed = false;
        changed |= Set(product.Sku, record.Sku!, v => product.Sku = v);
        changed |= Set(product.Name, record.Name!, v => product.Name = v);
        changed |= Set(product.NavkoloGroupRef, record.GroupRef, v => product.NavkoloGroupRef = v);
        changed |= Set(product.VariantGroup, Clip(record.VariantGroup, 100), v => product.VariantGroup = v);
        changed |= Set(product.VariantLabel, Clip(record.VariantLabel, 100), v => product.VariantLabel = v);
        changed |= SetPrice(product, record.Price!.Value, record.OldPrice, now);
        changed |= SetStock(product, record.Stock ?? 0, now);

        if (hidden && product.IsVisible)
        {
            product.IsVisible = false;
            changed = true;
        }

        if (product.Brand is null && Clip(record.Brand, 200) is { } brand)
        {
            product.Brand = brand;
            changed = true;
        }

        if (product.DescriptionHtml is null && sanitizer.Sanitize(TextToHtml(record.Description)) is { } description)
        {
            product.DescriptionHtml = description;
            changed = true;
        }

        changed |= FillSiteFields(product, record, now);
        return changed;
    }

    private static bool FillSiteFields(Product product, NavkoloProductRecord record, DateTimeOffset now)
    {
        var changed = false;
        if (product.Attributes.Count == 0 && record.Attributes is { Count: > 0 } attributes)
        {
            var order = 0;
            foreach (var a in attributes.Where(a => !string.IsNullOrWhiteSpace(a.Name) && !string.IsNullOrWhiteSpace(a.Value)).Take(50))
            {
                product.Attributes.Add(new ProductAttribute
                {
                    Id = Guid.CreateVersion7(now),
                    ProductId = product.Id,
                    Name = Clip(a.Name, 100)!,
                    Value = Clip(a.Value, 300)!,
                    SortOrder = order++,
                });
            }

            changed = order > 0;
        }

        if (product.Images.Count == 0 && record.ImageUrls is { Count: > 0 } urls)
        {
            var order = 0;
            foreach (var url in urls.Where(u => Uri.TryCreate(u, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https").Take(20))
            {
                product.Images.Add(new ProductImage
                {
                    Id = Guid.CreateVersion7(now),
                    ProductId = product.Id,
                    Url = url,
                    Alt = product.Name,
                    SortOrder = order++,
                });
            }

            changed |= order > 0;
        }

        return changed;
    }

    private static bool SetPrice(Product product, decimal amount, decimal? oldAmount, DateTimeOffset now)
    {
        if (product.Price.Amount == amount && product.Price.OldAmount == oldAmount)
        {
            return false;
        }

        product.Price.Amount = amount;
        product.Price.OldAmount = oldAmount;
        product.Price.UpdatedAt = now;
        return true;
    }

    private static bool SetStock(Product product, decimal quantity, DateTimeOffset now)
    {
        if (product.Stock.Quantity == quantity)
        {
            return false;
        }

        product.Stock.Quantity = quantity;
        product.Stock.UpdatedAt = now;
        return true;
    }

    private static bool Set(string? current, string? value, Action<string> apply)
    {
        if (value is null || current == value)
        {
            return false;
        }

        apply(value);
        return true;
    }

    private static string UniqueSlug(NavkoloProductRecord record, HashSet<string> taken)
    {
        var baseSlug = $"{Transliteration.ToSlug(record.Name!)}-{Transliteration.ToSlug(record.Sku!)}".Trim('-');
        if (baseSlug.Length > 280)
        {
            baseSlug = baseSlug[..280].TrimEnd('-');
        }

        var slug = baseSlug;
        for (var n = 2; !taken.Add(slug); n++)
        {
            slug = $"{baseSlug}-{n}";
        }

        return slug;
    }

    private static string? Clip(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim() is var v && v.Length > max ? v[..max] : value.Trim();

    /// <summary>Простий текст з Navkolo → абзаци HTML.</summary>
    internal static string? TextToHtml(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var paragraphs = text.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return string.Concat(paragraphs.Select(p => $"<p>{WebUtility.HtmlEncode(p)}</p>"));
    }
}
