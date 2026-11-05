using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Attributes;

internal sealed class AttributeUsage
{
    private readonly Dictionary<string, int> _products;
    private readonly Dictionary<string, int> _categories;

    private AttributeUsage(Dictionary<string, int> products, Dictionary<string, int> categories)
    {
        _products = products;
        _categories = categories;
    }

    public static async Task<AttributeUsage> LoadAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var products = (await db.Set<ProductAttribute>()
                .GroupBy(a => a.Name.Trim().ToUpper())
                .Select(g => new { g.Key, Count = g.Select(a => a.ProductId).Distinct().Count() })
                .ToListAsync(ct))
            .GroupBy(x => AttributeDefinition.Normalize(x.Key), StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Count), StringComparer.Ordinal);
        var categories = (await LoadFiltersAsync(db, ct))
            .SelectMany(filters => filters.Select(AttributeDefinition.Normalize).Distinct(StringComparer.Ordinal))
            .GroupBy(n => n, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
        return new AttributeUsage(products, categories);
    }

    public static async Task<int> CategoriesUsingAsync(PoliValkoDbContext db, string normalizedName, CancellationToken ct) =>
        (await LoadFiltersAsync(db, ct)).Count(filters => filters.Any(f => AttributeDefinition.Normalize(f) == normalizedName));

    public int Products(string normalizedName) => _products.GetValueOrDefault(normalizedName);

    public int Categories(string normalizedName) => _categories.GetValueOrDefault(normalizedName);

    private static Task<List<List<string>>> LoadFiltersAsync(PoliValkoDbContext db, CancellationToken ct) =>
        db.Set<Category>().AsNoTracking().Where(c => c.FilterAttributes != null).Select(c => c.FilterAttributes!).ToListAsync(ct);
}
