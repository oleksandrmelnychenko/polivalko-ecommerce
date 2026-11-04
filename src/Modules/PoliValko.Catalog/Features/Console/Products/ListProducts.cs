using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class ListProducts
{
    public static async Task<Results<Ok<PagedResponse<ConsoleProductListItemDto>>, ValidationProblem>> HandleAsync(
        [AsParameters] ConsoleProductQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var products = db.Set<Product>().AsNoTracking();
        switch (query.Stock?.Trim().ToLowerInvariant())
        {
            case null or "":
                break;
            case ProductStockFilters.In:
                products = products.Where(p => p.Stock.Quantity > 0);
                break;
            case ProductStockFilters.Low:
                products = products.Where(p => p.Stock.Quantity > 0 && p.Stock.Quantity <= ProductStockFilters.LowStockThreshold);
                break;
            case ProductStockFilters.Out:
                products = products.Where(p => p.Stock.Quantity <= 0);
                break;
            default:
                return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["stock"] = [$"Допустимі значення: {string.Join(", ", ProductStockFilters.All)}."],
                });
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var pattern = $"%{term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";
            products = products.Where(p => p.Sku == term
                || EF.Functions.ILike(p.Name, pattern, "\\")
                || (p.DisplayName != null && EF.Functions.ILike(p.DisplayName, pattern, "\\")));
        }

        if (query.CategoryId is { } categoryId)
        {
            products = products.Where(p => p.CategoryId == categoryId);
        }

        if (query.Visible is { } visible)
        {
            products = products.Where(p => p.IsVisible == visible);
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await products.CountAsync(ct);
        var items = await ConsoleProductQueries.ProjectListItemsAsync(db, products.OrderBy(p => p.DisplayName ?? p.Name).ThenBy(p => p.Id).Skip(page.Skip).Take(page.PageSize), ct);
        return TypedResults.Ok(PagedResponse<ConsoleProductListItemDto>.Create(items, page, total));
    }
}
