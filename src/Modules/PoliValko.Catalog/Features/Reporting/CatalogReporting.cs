using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Reporting;

internal sealed class CatalogReporting(PoliValkoDbContext db) : ICatalogReporting
{
    public async Task<IReadOnlyList<AnalyticsCatalogProduct>> GetAnalyticsProductsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct) =>
        ids.Count == 0 ? [] : await db.Set<Product>().AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new AnalyticsCatalogProduct(p.Id, p.DisplayName ?? p.Name, p.Sku,
                Math.Max(0m, p.Stock.Quantity - p.Stock.ReservedQuantity)))
            .ToListAsync(ct);

    public async Task<AnalyticsCatalogInventory> GetAnalyticsInventoryAsync(CancellationToken ct)
    {
        const decimal threshold = ProductStockFilters.LowStockThreshold;
        var counts = await db.Set<Product>().AsNoTracking().Where(p => p.IsVisible)
            .Select(p => p.Stock.Quantity - p.Stock.ReservedQuantity)
            .GroupBy(available => available <= 0 ? 0 : available <= threshold ? 1 : 2)
            .Select(group => new { Band = group.Key, Products = group.Count() })
            .ToDictionaryAsync(group => group.Band, group => group.Products, ct);
        return new AnalyticsCatalogInventory(counts.GetValueOrDefault(2), counts.GetValueOrDefault(1), counts.GetValueOrDefault(0), threshold);
    }

    public async Task<IReadOnlyList<AnalyticsCatalogMatch>> FindAnalyticsProductsAsync(IReadOnlyCollection<string> externalIds,
        IReadOnlyCollection<string> skus, CancellationToken ct) =>
        externalIds.Count == 0 && skus.Count == 0 ? [] : await db.Set<Product>().AsNoTracking()
            .Where(p => externalIds.Contains(p.NavkoloId) || skus.Contains(p.Sku))
            .Select(p => new AnalyticsCatalogMatch(p.Id, p.NavkoloId, p.DisplayName ?? p.Name, p.Sku))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ProductCard>> GetProductCardsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct) =>
        await db.Set<Product>().AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new ProductCard(
                p.Id,
                p.DisplayName ?? p.Name,
                p.Sku,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<LowStockProduct>> GetLowStockAsync(int take, CancellationToken ct) =>
        await db.Set<Product>().AsNoTracking()
            .Where(p => p.IsVisible && p.Stock.Quantity <= ProductStockFilters.LowStockThreshold)
            .OrderBy(p => p.Stock.Quantity)
            .ThenBy(p => p.DisplayName ?? p.Name)
            .ThenBy(p => p.Id)
            .Take(take)
            .Select(p => new LowStockProduct(p.Id, p.DisplayName ?? p.Name, p.Sku, p.Stock.Quantity))
            .ToListAsync(ct);

    public async Task<IReadOnlyList<ProductSearchHit>> SearchProductsAsync(string term, int limit, CancellationToken ct)
    {
        var pattern = SqlLike.Contains(term);
        var upper = term.ToUpperInvariant();
        var products = await db.Set<Product>().AsNoTracking()
            .Where(p => EF.Functions.ILike(p.Name, pattern, SqlLike.Escape)
                || (p.DisplayName != null && EF.Functions.ILike(p.DisplayName, pattern, SqlLike.Escape))
                || EF.Functions.ILike(p.Sku, pattern, SqlLike.Escape))
            .OrderBy(p => p.Sku.ToUpper() == upper ? 0 : 1)
            .ThenBy(p => p.DisplayName ?? p.Name)
            .ThenBy(p => p.Id)
            .Take(limit)
            .Select(p => new
            {
                p.Id,
                Name = p.DisplayName ?? p.Name,
                p.Sku,
                ImageUrl = p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                Price = p.Price.Amount,
                p.IsVisible,
            })
            .ToListAsync(ct);
        return products.Select(p => new ProductSearchHit(p.Id, p.Name, p.Sku, p.ImageUrl, p.Price, p.IsVisible)).ToList();
    }
}
