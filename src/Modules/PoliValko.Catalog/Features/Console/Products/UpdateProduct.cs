using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Redirects;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Text;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class UpdateProduct
{
    public static async Task<Results<Ok<ConsoleProductDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        UpdateProductRequest request,
        PoliValkoDbContext db,
        IRichTextSanitizer sanitizer,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var product = await ConsoleProductQueries.LoadProductAsync(db, id, tracking: true, ct);
        if (product is null)
        {
            return ConsoleProductQueries.ProductNotFound();
        }

        var errors = new Dictionary<string, string[]>();
        var slug = string.IsNullOrWhiteSpace(request.Slug) ? product.Slug : request.Slug.Trim().ToLowerInvariant();
        if (!CatalogConsoleValidation.IsSlug(slug) || slug.Length > 300)
        {
            errors["slug"] = ["Адреса: латинські літери, цифри й дефіси, до 300 символів."];
        }
        else if (slug != product.Slug && await db.Set<Product>().AnyAsync(p => p.Slug == slug, ct))
        {
            errors["slug"] = ["Така адреса вже зайнята іншим товаром."];
        }

        var categoryId = request.CategoryId ?? product.CategoryId;
        if (!await db.Set<Category>().AnyAsync(c => c.Id == categoryId, ct))
        {
            errors["categoryId"] = ["Розділ не знайдено."];
        }

        CatalogConsoleValidation.CheckLength(errors, "displayName", request.DisplayName, 500);
        var brand = await CatalogConsoleValidation.ResolveBrandAsync(db, request.Brand, product.Brand, errors, ct);
        var labelIds = request.LabelIds is null ? null : await CatalogConsoleValidation.ResolveManualLabelsAsync(db, request.LabelIds, "labelIds", errors, ct);
        CatalogConsoleValidation.CheckLength(errors, "seoTitle", request.SeoTitle, 200);
        CatalogConsoleValidation.CheckLength(errors, "seoDescription", request.SeoDescription, 500);
        var description = sanitizer.Sanitize(request.DescriptionHtml);
        CatalogConsoleValidation.CheckLength(errors, "descriptionHtml", description, 20_000);
        var attributes = CatalogConsoleValidation.ValidateAttributes(request.Attributes, errors);

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var before = new { product.DisplayName, product.Slug, product.CategoryId, product.Brand, product.IsVisible, product.SeoTitle, product.SeoDescription };
        var oldSlug = product.Slug;
        var now = time.GetUtcNow();

        product.DisplayName = CatalogConsoleValidation.NullIfEmpty(request.DisplayName);
        product.Slug = slug;
        product.CategoryId = categoryId;
        product.Brand = brand;
        product.DescriptionHtml = description;
        product.IsVisible = request.IsVisible;
        product.SeoTitle = CatalogConsoleValidation.NullIfEmpty(request.SeoTitle);
        product.SeoDescription = CatalogConsoleValidation.NullIfEmpty(request.SeoDescription);
        product.UpdatedAt = now;

        db.RemoveRange(product.Attributes);
        product.Attributes = attributes
            .Select((a, i) => new ProductAttribute { Id = Guid.CreateVersion7(now), ProductId = product.Id, Name = a.Name, Value = a.Value, SortOrder = i })
            .ToList();

        await CatalogDictionarySync.AddMissingAttributesAsync(db, attributes.Select(a => a.Name).ToList(), ct);
        if (labelIds is not null)
        {
            await ProductLabelLinks.ReplaceAsync(db, product.Id, labelIds, ct);
        }

        if (oldSlug != slug)
        {
            await RedirectWriter.AddRedirectAsync(db, $"/product/{oldSlug}", $"/product/{slug}", now, ct);
        }

        audit.Record("catalog.product_updated", "Product", product.Sku, new
        {
            before,
            after = new { product.DisplayName, product.Slug, product.CategoryId, product.Brand, product.IsVisible, product.SeoTitle, product.SeoDescription },
            attributes = attributes.Count,
            labelIds,
        });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(ConsoleProductQueries.ProductTags(oldSlug, slug), ct);

        return TypedResults.Ok(await ConsoleProductQueries.ToDtoAsync(db, product, time.GetUtcNow(), ct));
    }
}
