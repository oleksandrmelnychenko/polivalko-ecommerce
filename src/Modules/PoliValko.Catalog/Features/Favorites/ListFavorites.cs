using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Favorites;

internal static class ListFavorites
{
    public static async Task<Ok<List<ProductListItemDto>>> HandleAsync(HttpContext http, PoliValkoDbContext db, CancellationToken ct)
    {
        var customerId = http.User.CustomerId();
        var ids = await db.Set<Favorite>()
            .AsNoTracking()
            .Where(f => f.CustomerId == customerId)
            .OrderByDescending(f => f.AddedAt)
            .Select(f => f.ProductId)
            .ToListAsync(ct);
        var items = (await ProductListing.ListItems(db.Set<Product>().AsNoTracking().Where(p => p.IsVisible && ids.Contains(p.Id))).ToListAsync(ct))
            .ToDictionary(r => r.Id, ProductListing.ToListItem);

        return TypedResults.Ok(ids.Where(items.ContainsKey).Select(id => items[id]).ToList());
    }
}
