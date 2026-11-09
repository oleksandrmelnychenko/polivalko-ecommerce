using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Favorites;

internal static class ListFavoriteIds
{
    public static async Task<Ok<List<Guid>>> HandleAsync(HttpContext http, PoliValkoDbContext db, CancellationToken ct)
    {
        var visibleProducts = await CatalogVisibility.ProductsAsync(db, ct);
        var customerId = http.User.CustomerId();
        var ids = await db.Set<Favorite>()
            .AsNoTracking()
            .Where(f => f.CustomerId == customerId && visibleProducts.Any(p => p.Id == f.ProductId))
            .OrderByDescending(f => f.AddedAt)
            .Select(f => f.ProductId)
            .ToListAsync(ct);
        return TypedResults.Ok(ids);
    }
}
