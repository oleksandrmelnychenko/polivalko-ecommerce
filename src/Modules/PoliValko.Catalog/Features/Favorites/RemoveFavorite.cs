using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Favorites;

internal static class RemoveFavorite
{
    public static async Task<NoContent> HandleAsync(
        Guid productId,
        HttpContext http,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var customerId = http.User.CustomerId();
        await db.Set<Favorite>()
            .Where(f => f.CustomerId == customerId && f.ProductId == productId)
            .ExecuteDeleteAsync(ct);
        return TypedResults.NoContent();
    }
}
