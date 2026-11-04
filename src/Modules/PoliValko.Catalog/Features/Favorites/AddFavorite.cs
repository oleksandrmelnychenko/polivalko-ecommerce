using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Favorites;

internal static class AddFavorite
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid productId,
        HttpContext http,
        PoliValkoDbContext db,
        TimeProvider time,
        CancellationToken ct)
    {
        var customerId = http.User.CustomerId()!.Value;
        if (!await db.Set<Product>().AnyAsync(p => p.Id == productId && p.IsVisible, ct))
        {
            return Problems.NotFound("catalog.product_not_found", "Товар не знайдено", "Товару немає або він прихований.");
        }

        var favorites = db.Set<Favorite>().Where(f => f.CustomerId == customerId);
        if (await favorites.AnyAsync(f => f.ProductId == productId, ct))
        {
            return TypedResults.NoContent();
        }

        if (await favorites.CountAsync(ct) >= Favorite.MaxPerCustomer)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "catalog.favorites_limit",
                $"В обраному може бути до {Favorite.MaxPerCustomer} товарів",
                "Приберіть товари, які вже не потрібні, щоб додати нові.");
        }

        await db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO catalog.favorites (customer_id, product_id, added_at)
            VALUES ({customerId}, {productId}, {time.GetUtcNow()})
            ON CONFLICT DO NOTHING
            """,
            ct);
        return TypedResults.NoContent();
    }
}
