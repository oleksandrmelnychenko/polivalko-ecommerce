using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Import;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Persistence;

internal static class CatalogDemoData
{
    private sealed record DemoImage(string Url, string Alt, string? Credit);

    private sealed record DemoItem(
        string Category,
        string Name,
        string? Brand,
        decimal Price,
        decimal? OldPrice,
        decimal Stock,
        string? Description,
        List<DemoImage>? Images,
        List<ProductAttributeDto>? Attributes,
        string? VariantGroup,
        string? VariantLabel);

    private static readonly Dictionary<string, string[]> DemoFilters = new(StringComparer.Ordinal)
    {
        ["vse-dlia-polyvu"] = ["Матеріал", "Довжина", "Об'єм"],
        ["ruchnyi-instrument"] = ["Матеріал"],
        ["tekhnika-dlia-sadu-ta-horodu"] = ["Тип двигуна"],
    };

    public static async Task SeedAsync(PoliValkoDbContext db, TimeProvider time, CancellationToken ct = default)
    {
        var items = await LoadAsync(ct);
        if (items.Count == 0)
        {
            return;
        }

        var categories = await db.Set<Category>().ToDictionaryAsync(c => c.Slug, ct);
        foreach (var (slug, filters) in DemoFilters)
        {
            if (categories.TryGetValue(slug, out var category) && category.FilterAttributes is not { Count: > 0 })
            {
                category.FilterAttributes = [.. filters];
            }
        }

        var existing = await db.Set<Product>()
            .Include(p => p.Price)
            .Include(p => p.Stock)
            .Include(p => p.Images)
            .Include(p => p.Attributes)
            .Where(p => p.NavkoloId.StartsWith("demo-"))
            .AsSplitQuery()
            .ToDictionaryAsync(p => p.NavkoloId, ct);
        var now = time.GetUtcNow();

        for (var i = 0; i < items.Count; i++)
        {
            var item = items[i];
            if (!categories.TryGetValue(item.Category, out var category))
            {
                throw new InvalidOperationException($"demo-catalog.json: невідома категорія '{item.Category}'.");
            }

            var number = i + 1;
            var sku = $"DEMO-{number:000}";
            if (!existing.TryGetValue($"demo-{number}", out var product))
            {
                var id = Guid.CreateVersion7(now);
                product = new Product
                {
                    Id = id,
                    NavkoloId = $"demo-{number}",
                    Sku = sku,
                    Name = item.Name,
                    Slug = $"{Transliteration.ToSlug(item.Name)}-{sku.ToLowerInvariant()}",
                    CategoryId = category.Id,
                    Brand = item.Brand,
                    DescriptionHtml = ImportText.TextToHtml(item.Description),
                    IsVisible = true,
                    CreatedAt = now,
                    UpdatedAt = now,
                    Price = new ProductPrice { ProductId = id },
                    Stock = new ProductStock { ProductId = id },
                };
                db.Add(product);
            }

            product.Sku = sku;
            product.Name = item.Name;
            product.NavkoloGroupRef = category.NavkoloRef;
            product.VariantGroup = item.VariantGroup;
            product.VariantLabel = item.VariantLabel;
            if (product.Price.Amount != item.Price || product.Price.OldAmount != item.OldPrice || product.Price.UpdatedAt == default)
            {
                product.Price.Amount = item.Price;
                product.Price.OldAmount = item.OldPrice;
                product.Price.UpdatedAt = now;
            }

            if (product.Stock.Quantity != item.Stock || product.Stock.UpdatedAt == default)
            {
                product.Stock.Quantity = item.Stock;
                product.Stock.UpdatedAt = now;
            }

            if (product.UpdatedAt == default)
            {
                product.UpdatedAt = now;
            }

            if (product.Images.Count == 0)
            {
                var sort = 0;
                foreach (var image in item.Images ?? [])
                {
                    product.Images.Add(new ProductImage
                    {
                        Id = Guid.CreateVersion7(now),
                        ProductId = product.Id,
                        Url = image.Url,
                        Alt = image.Alt,
                        Credit = image.Credit,
                        SortOrder = sort++,
                    });
                }
            }

            if (product.Attributes.Count == 0)
            {
                var sort = 0;
                foreach (var attribute in item.Attributes ?? [])
                {
                    product.Attributes.Add(new ProductAttribute
                    {
                        Id = Guid.CreateVersion7(now),
                        ProductId = product.Id,
                        Name = attribute.Name,
                        Value = attribute.Value,
                        SortOrder = sort++,
                    });
                }
            }
        }

        await db.SaveChangesAsync(ct);
        await SeedCollectionAsync(db, ct);
    }

    private static async Task SeedCollectionAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        if (await db.Set<HomeCollection>().AnyAsync(c => c.Code == "recommended", ct))
        {
            return;
        }

        var recommended = new HomeCollection { Id = Guid.CreateVersion7(), Code = "recommended", Title = "Рекомендовані товари", SortOrder = 1 };
        db.Add(recommended);

        recommended.ProductIds = await db.Set<Product>()
            .Where(p => p.IsVisible && p.NavkoloId.StartsWith("demo-") && p.Stock.Quantity > 0 && p.Images.Any())
            .OrderByDescending(p => p.Price.OldAmount != null)
            .ThenBy(p => p.Sku)
            .Select(p => p.Id)
            .Take(8)
            .ToListAsync(ct);
        await db.SaveChangesAsync(ct);
    }

    public static async Task<IReadOnlyList<NavkoloProductRecord>> LoadNavkoloRecordsAsync(CancellationToken ct)
    {
        var groups = TopLevelCategories.All.ToDictionary(c => c.Slug, c => c.NavkoloRef);
        return (await LoadAsync(ct))
            .Select((item, i) => new NavkoloProductRecord(
                $"demo-{i + 1}",
                $"DEMO-{i + 1:000}",
                item.Name,
                groups.GetValueOrDefault(item.Category),
                item.Price,
                item.OldPrice,
                item.Stock,
                item.Brand,
                item.VariantGroup,
                item.VariantLabel,
                item.Description,
                item.Attributes,
                item.Images?.Select(image => image.Url).ToList()))
            .ToList();
    }

    private static async Task<List<DemoItem>> LoadAsync(CancellationToken ct)
    {
        var assembly = typeof(CatalogDemoData).Assembly;
        var name = assembly.GetManifestResourceNames().FirstOrDefault(n => n.EndsWith("demo-catalog.json", StringComparison.Ordinal));
        if (name is null)
        {
            return [];
        }

        await using var stream = assembly.GetManifestResourceStream(name)!;
        return await JsonSerializer.DeserializeAsync<List<DemoItem>>(stream, JsonSerializerOptions.Web, ct) ?? [];
    }
}
