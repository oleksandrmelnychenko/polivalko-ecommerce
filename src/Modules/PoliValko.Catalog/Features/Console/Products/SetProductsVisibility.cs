using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class SetProductsVisibility
{
    public static async Task<Results<Ok<SetProductsVisibilityResult>, ValidationProblem>> HandleAsync(
        SetProductsVisibilityRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var ids = (request.ProductIds ?? []).Distinct().ToList();
        if (ids.Count is 0 or > 200)
        {
            errors["productIds"] = ["Оберіть від 1 до 200 товарів."];
        }

        if (request.Visible is null)
        {
            errors["visible"] = ["Вкажіть, показати чи приховати товари."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var visible = request.Visible!.Value;
        var products = await db.Set<Product>().Where(p => ids.Contains(p.Id)).ToListAsync(ct);
        if (products.Count != ids.Count)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["productIds"] = ["Частину товарів не знайдено."] });
        }

        var changed = products.Where(p => p.IsVisible != visible).ToList();
        if (changed.Count == 0)
        {
            return TypedResults.Ok(new SetProductsVisibilityResult(0));
        }

        var now = time.GetUtcNow();
        foreach (var product in changed)
        {
            product.IsVisible = visible;
            product.UpdatedAt = now;
        }

        audit.Record("catalog.products_visibility_changed", "Product", null, new { visible, skus = changed.Select(p => p.Sku).ToList() });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(ConsoleProductQueries.ProductTags([.. changed.Select(p => p.Slug)]), ct);

        return TypedResults.Ok(new SetProductsVisibilityResult(changed.Count));
    }
}
