using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

public sealed record BestsellerDto(ProductListItemDto Product, int Orders);

public sealed record BestsellersResponse(IReadOnlyList<BestsellerDto> Items, int PeriodDays);

internal static class GetBestsellers
{
    private const int PeriodDays = 90;
    private const int MaxTake = 12;
    private const int Candidates = 40;

    public static async Task<Results<Ok<BestsellersResponse>, ValidationProblem>> HandleAsync(
        [FromQuery] int? take,
        PoliValkoDbContext db,
        IProductSalesSource sales,
        TimeProvider time,
        CancellationToken ct)
    {
        var count = take ?? 1;
        if (count is < 1 or > MaxTake)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["take"] = [$"Від 1 до {MaxTake}."],
            });
        }

        var top = await sales.TopSinceAsync(time.GetUtcNow().AddDays(-PeriodDays), Candidates, ct);
        if (top.Count == 0)
        {
            return TypedResults.Ok(new BestsellersResponse([], PeriodDays));
        }

        var ids = top.Select(t => t.ProductId).ToList();
        var visible = await CatalogVisibility.ProductsAsync(db, ct);
        var rows = await ProductListing.ListItems(visible.Where(p => ids.Contains(p.Id) && (p.Stock.Quantity - p.Stock.ReservedQuantity) > 0))
            .ToListAsync(ct);
        var products = (await ProductListing.ToListItemsAsync(db, rows, time, ct)).ToDictionary(p => p.Id);

        var items = top
            .Where(t => products.ContainsKey(t.ProductId))
            .Take(count)
            .Select(t => new BestsellerDto(products[t.ProductId], t.Orders))
            .ToList();
        return TypedResults.Ok(new BestsellersResponse(items, PeriodDays));
    }
}
