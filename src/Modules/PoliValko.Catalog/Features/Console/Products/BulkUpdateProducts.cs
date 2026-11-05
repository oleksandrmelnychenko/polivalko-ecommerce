using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class BulkUpdateProducts
{
    public const int MaxProducts = 200;

    public static async Task<Results<Ok<BulkUpdateProductsResult>, ValidationProblem>> HandleAsync(
        BulkUpdateProductsRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var ids = (request.ProductIds ?? []).Distinct().ToList();
        if (ids.Count is 0 or > MaxProducts)
        {
            errors["productIds"] = [$"Оберіть від 1 до {MaxProducts} товарів."];
        }

        if (request.CategoryId is { } categoryId && !await db.Set<Category>().AnyAsync(c => c.Id == categoryId, ct))
        {
            errors["categoryId"] = ["Розділ не знайдено."];
        }

        var clearBrand = request.Brand is not null && string.IsNullOrWhiteSpace(request.Brand);
        var brand = request.Brand is null || clearBrand ? null : await CatalogConsoleValidation.ResolveBrandAsync(db, request.Brand, null, errors, ct);
        var add = await CatalogConsoleValidation.ResolveManualLabelsAsync(db, request.AddLabelIds, "addLabelIds", errors, ct);
        var remove = await CatalogConsoleValidation.ResolveManualLabelsAsync(db, request.RemoveLabelIds, "removeLabelIds", errors, ct);
        if (add.Intersect(remove).Any())
        {
            errors["removeLabelIds"] = ["Одну мітку не можна водночас додати й зняти."];
        }

        if (errors.Count == 0 && request.CategoryId is null && request.Brand is null && add.Count == 0 && remove.Count == 0 && request.IsVisible is null)
        {
            errors["productIds"] = ["Оберіть, що змінити: розділ, бренд, мітки чи видимість."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var products = await db.Set<Product>().Where(p => ids.Contains(p.Id)).ToListAsync(ct);
        if (products.Count != ids.Count)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["productIds"] = ["Частину товарів не знайдено."] });
        }

        var links = await db.Set<ProductLabelLink>()
            .Where(l => ids.Contains(l.ProductId) && (add.Contains(l.LabelId) || remove.Contains(l.LabelId)))
            .ToListAsync(ct);
        var linked = links.Select(l => (l.ProductId, l.LabelId)).ToHashSet();
        var changed = new HashSet<Guid>();
        var now = time.GetUtcNow();
        foreach (var product in products)
        {
            var touched = false;
            if (request.CategoryId is { } target && product.CategoryId != target)
            {
                product.CategoryId = target;
                touched = true;
            }

            if ((brand is not null || clearBrand) && product.Brand != brand)
            {
                product.Brand = brand;
                touched = true;
            }

            if (request.IsVisible is { } visible && product.IsVisible != visible)
            {
                product.IsVisible = visible;
                touched = true;
            }

            foreach (var labelId in add.Where(l => !linked.Contains((product.Id, l))))
            {
                db.Add(new ProductLabelLink { ProductId = product.Id, LabelId = labelId });
                touched = true;
            }

            foreach (var link in links.Where(l => l.ProductId == product.Id && remove.Contains(l.LabelId)))
            {
                db.Remove(link);
                touched = true;
            }

            if (touched)
            {
                product.UpdatedAt = now;
                changed.Add(product.Id);
            }
        }

        if (changed.Count == 0)
        {
            return TypedResults.Ok(new BulkUpdateProductsResult(0));
        }

        var updated = products.Where(p => changed.Contains(p.Id)).ToList();
        audit.Record("catalog.products_bulk_updated", "Product", null, new
        {
            request.CategoryId,
            brand = clearBrand ? string.Empty : brand,
            request.IsVisible,
            addLabelIds = add,
            removeLabelIds = remove,
            skus = updated.Select(p => p.Sku).ToList(),
        });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, .. ConsoleProductQueries.ProductTags([.. updated.Select(p => p.Slug)])], ct);
        return TypedResults.Ok(new BulkUpdateProductsResult(updated.Count));
    }
}
