using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

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
        IMemoryCache cache,
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

        var categories = await CatalogVisibility.CategoriesAsync(db, ct);
        var purchasable = CatalogVisibility.Products(db, categories.Select(c => c.Id).ToArray()).Where(ProductListing.Purchasable);
        var items = await PickAsync(top, count, purchasable, categories, db, cache, time, KyivTime.Today(time), ct);
        return TypedResults.Ok(new BestsellersResponse(items, PeriodDays));
    }

    /// <summary>
    /// The most ordered products that can be bought, in the order of their orders, without those a seasonal rule keeps
    /// for other months: garlands ordered in December are no bestseller in February. A product that only its receipts
    /// put out of season stays: it is still ordered on the site, and most of the catalog is out of season in winter.
    /// </summary>
    internal static async Task<List<BestsellerDto>> PickAsync(IReadOnlyList<ProductSalesCount> top, int count,
        IQueryable<Product> purchasable, IReadOnlyList<Category> categories, PoliValkoDbContext db, IMemoryCache cache,
        TimeProvider time, DateOnly today, CancellationToken ct)
    {
        var ids = top.Select(t => t.ProductId).ToArray();
        var seasons = await SeasonClassifier.ClassifyAsync(purchasable, categories, db, cache, today, today, ct, only: ids);
        var current = seasons.Products
            .Where(s => !(s.Season.RuleOff && s.Season.State != (int)Season.In))
            .Select(s => s.Product);
        var rows = await ProductListing.ListItems(current).ToListAsync(ct);
        var visibleProducts = CatalogVisibility.Products(db, categories.Select(c => c.Id).ToArray());
        var products = (await ProductListing.ToListItemsAsync(db, visibleProducts, rows, time, ct)).ToDictionary(p => p.Id);
        return top
            .Where(t => products.ContainsKey(t.ProductId))
            .Take(count)
            .Select(t => new BestsellerDto(products[t.ProductId], t.Orders))
            .ToList();
    }
}
