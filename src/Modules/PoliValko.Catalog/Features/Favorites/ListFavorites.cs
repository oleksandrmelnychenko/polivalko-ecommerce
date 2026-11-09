using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Favorites;

internal static class ListFavorites
{
    public static async Task<Ok<List<ProductListItemDto>>> HandleAsync(HttpContext http, PoliValkoDbContext db, TimeProvider time, CancellationToken ct)
    {
        var visibleProducts = await CatalogVisibility.ProductsAsync(db, ct);
        var customerId = http.User.CustomerId();
        var ids = await db.Set<Favorite>()
            .AsNoTracking()
            .Where(f => f.CustomerId == customerId)
            .OrderByDescending(f => f.AddedAt)
            .Select(f => f.ProductId)
            .ToListAsync(ct);
        var rows = await ProductListing.ListItems(visibleProducts.AsNoTracking().Where(p => p.IsVisible && ids.Contains(p.Id))).ToListAsync(ct);
        var items = (await ProductListing.ToListItemsAsync(db, rows, time, ct)).ToDictionary(r => r.Id);

        return TypedResults.Ok(ids.Where(items.ContainsKey).Select(id => items[id]).ToList());
    }
}
