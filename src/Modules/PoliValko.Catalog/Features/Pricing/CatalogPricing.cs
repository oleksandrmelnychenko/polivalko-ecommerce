using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Pricing;

internal sealed class CatalogPricing(PoliValkoDbContext db) : ICatalogPricing
{
    public async Task<IReadOnlyDictionary<Guid, ProductPricing>> GetAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct)
    {
        var ids = productIds.Distinct().ToList();
        return await db.Set<Product>()
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new ProductPricing(
                p.Id,
                p.Slug,
                p.Sku,
                p.DisplayName ?? p.Name,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.Price.Amount,
                p.Stock.Quantity,
                p.IsVisible))
            .ToDictionaryAsync(p => p.Id, ct);
    }
}
