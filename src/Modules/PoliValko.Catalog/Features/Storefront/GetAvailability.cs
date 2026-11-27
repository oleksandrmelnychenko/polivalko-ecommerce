using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

/// <param name="Available">Units that can be ordered now; 0 when the product cannot be bought.</param>
public sealed record ProductAvailabilityDto(Guid ProductId, bool InStock, int Available);

/// <summary>
/// What can be bought right now, for the products a page shows. Pages are cached (the CDN keeps a copy for minutes),
/// so the browser asks this after loading and shows the live answer: the last unit someone just ordered stops being
/// «В наявності» at once, and a product back in stock can be bought again. Counted as checkout counts it.
/// </summary>
internal static class GetAvailability
{
    public const int MaxProducts = 100;

    public static async Task<Results<Ok<List<ProductAvailabilityDto>>, ValidationProblem>> HandleAsync(
        string? ids,
        HttpResponse response,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var parsed = new List<Guid>();
        foreach (var part in (ids ?? string.Empty).Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!Guid.TryParse(part, out var id))
            {
                return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = ["Ідентифікатори товарів через кому."] });
            }

            parsed.Add(id);
        }

        var wanted = parsed.Distinct().ToArray();
        if (wanted.Length > MaxProducts)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["ids"] = [$"Не більше {MaxProducts} товарів."] });
        }

        response.Headers.CacheControl = "no-store";
        if (wanted.Length == 0) return TypedResults.Ok(new List<ProductAvailabilityDto>());

        var rows = await (await CatalogVisibility.ProductsAsync(db, ct))
            .Where(p => wanted.Contains(p.Id))
            .Select(p => new { p.Id, p.Price.Amount, Free = p.Stock.Quantity - p.Stock.ReservedQuantity })
            .ToListAsync(ct);
        return TypedResults.Ok(rows
            .Select(r =>
            {
                var available = r.Amount > 0 ? (int)Math.Max(Math.Floor(r.Free), 0) : 0;
                return new ProductAvailabilityDto(r.Id, available >= 1, available);
            })
            .ToList());
    }
}
