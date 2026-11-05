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
        TimeProvider time,
        CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var errors = new Dictionary<string, string[]>();
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
                errors["stock"] = [$"Допустимі значення: {string.Join(", ", ProductStockFilters.All)}."];
                break;
        }

        if (products.WithFill(query.Fill) is { } filled)
        {
            products = filled;
        }
        else
        {
            errors["fill"] = [$"Допустимі значення: {string.Join(", ", ProductFillFilters.All)}."];
        }

        if (query.NewDays is { } days)
        {
            if (days is < 1 or > 3650)
            {
                errors["newDays"] = ["Від 1 до 3650 днів."];
            }
            else
            {
                products = products.CreatedSince(now, days);
            }
        }

        if (query.LabelId is { } labelId)
        {
            var label = await db.Set<ProductLabel>().AsNoTracking().FirstOrDefaultAsync(l => l.Id == labelId, ct);
            if (label is null)
            {
                errors["labelId"] = ["Мітку не знайдено."];
            }
            else
            {
                products = products.WithLabel(db, label, now);
            }
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var pattern = SqlLike.Contains(term);
            products = products.Where(p => p.Sku == term
                || EF.Functions.ILike(p.Name, pattern, SqlLike.Escape)
                || (p.DisplayName != null && EF.Functions.ILike(p.DisplayName, pattern, SqlLike.Escape)));
        }

        if (query.CategoryId is { } categoryId)
        {
            products = products.Where(p => p.CategoryId == categoryId);
        }

        if (query.Visible is { } visible)
        {
            products = products.Where(p => p.IsVisible == visible);
        }

        if (!string.IsNullOrWhiteSpace(query.Brand))
        {
            products = products.WithBrand(query.Brand);
        }

        if (query.HiddenWithStock == true)
        {
            products = products.HiddenWithStock();
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await products.CountAsync(ct);
        var items = await ConsoleProductQueries.ProjectListItemsAsync(db, products.OrderBy(p => p.DisplayName ?? p.Name).ThenBy(p => p.Id).Skip(page.Skip).Take(page.PageSize), now, ct);
        return TypedResults.Ok(PagedResponse<ConsoleProductListItemDto>.Create(items, page, total));
    }
}
