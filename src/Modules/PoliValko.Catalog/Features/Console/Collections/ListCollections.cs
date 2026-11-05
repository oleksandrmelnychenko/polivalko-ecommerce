using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Collections;

internal static class ListCollections
{
    public static async Task<Ok<List<ConsoleCollectionDto>>> HandleAsync(PoliValkoDbContext db, TimeProvider time, CancellationToken ct)
    {
        var collections = await db.Set<HomeCollection>().AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Title).ToListAsync(ct);
        var products = await ConsoleProductQueries.LoadListItemsAsync(db, collections.SelectMany(c => c.ProductIds), time.GetUtcNow(), ct);
        return TypedResults.Ok(collections.Select(c => CollectionEditor.ToDto(c, products)).ToList());
    }
}
