using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Admin.Products;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Admin.Collections;

internal static class ListCollections
{
    public static async Task<Ok<List<AdminCollectionDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var collections = await db.Set<HomeCollection>().AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Title).ToListAsync(ct);
        var products = await AdminProductQueries.LoadListItemsAsync(db, collections.SelectMany(c => c.ProductIds), ct);
        return TypedResults.Ok(collections.Select(c => CollectionEditor.ToDto(c, products)).ToList());
    }
}
