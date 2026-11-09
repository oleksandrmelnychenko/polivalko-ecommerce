using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Pricing;

internal sealed class CatalogPricing(PoliValkoDbContext db) : ICatalogPricing
{
    public async Task<IReadOnlyDictionary<Guid, string>> NavkoloIdsAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct) =>
        await db.Set<Product>().Where(p => productIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.NavkoloId, ct);

    public async Task<IReadOnlyDictionary<Guid, ProductPricing>> GetAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct)
    {
        var visibleProducts = await CatalogVisibility.ProductsAsync(db, ct);
        var ids = productIds.Distinct().ToList();
        return await visibleProducts
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new ProductPricing(
                p.Id,
                p.Slug,
                p.Sku,
                p.DisplayName ?? p.Name,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.Price.Amount,
                (p.Stock.Quantity - p.Stock.ReservedQuantity),
                p.IsVisible))
            .ToDictionaryAsync(p => p.Id, ct);
    }
}
