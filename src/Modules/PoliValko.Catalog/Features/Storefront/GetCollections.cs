using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

internal static class GetCollections
{
    public static async Task<Ok<List<CollectionDto>>> HandleAsync(PoliValkoDbContext db, TimeProvider time, CancellationToken ct)
    {
        var collections = await db.Set<HomeCollection>()
            .AsNoTracking()
            .Where(c => c.IsVisible)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Title)
            .ToListAsync(ct);
        var ids = collections.SelectMany(c => c.ProductIds).Distinct().ToList();
        var rows = await ProductListing.ListItems(db.Set<Product>().AsNoTracking().Where(p => p.IsVisible && ids.Contains(p.Id))).ToListAsync(ct);
        var items = (await ProductListing.ToListItemsAsync(db, rows, time, ct)).ToDictionary(r => r.Id);

        return TypedResults.Ok(collections
            .Select(c => new CollectionDto(c.Code, c.Title, c.ProductIds.Where(items.ContainsKey).Select(id => items[id]).ToList()))
            .ToList());
    }
}
