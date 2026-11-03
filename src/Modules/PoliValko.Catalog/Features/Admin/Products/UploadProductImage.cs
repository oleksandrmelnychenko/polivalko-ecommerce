using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Admin.Products;

internal static class UploadProductImage
{
    public static async Task<Results<Ok<AdminProductDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        IFormFile file,
        [FromForm] string? alt,
        PoliValkoDbContext db,
        IMediaStorage media,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var product = await AdminProductQueries.LoadProductAsync(db, id, tracking: true, ct);
        if (product is null)
        {
            return AdminProductQueries.ProductNotFound();
        }

        if (product.Images.Count >= 20)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = ["Не більше 20 фото в товару."] });
        }

        StoredMedia stored;
        try
        {
            await using var stream = file.OpenReadStream();
            stored = await media.SaveImageAsync("products", stream, ct);
        }
        catch (MediaValidationException ex)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [ex.Message] });
        }

        var now = time.GetUtcNow();
        var image = new ProductImage
        {
            Id = Guid.CreateVersion7(now),
            ProductId = product.Id,
            Url = stored.Url,
            Alt = string.IsNullOrWhiteSpace(alt) ? product.DisplayName ?? product.Name : alt.Trim()[..Math.Min(alt.Trim().Length, 300)],
            SortOrder = product.Images.Count == 0 ? 0 : product.Images.Max(i => i.SortOrder) + 1,
        };
        db.Add(image);
        product.Images.Add(image);
        product.UpdatedAt = now;
        audit.Record("catalog.product_image_added", "Product", product.Sku, new { image.Url });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(AdminProductQueries.ProductTags(product.Slug), ct);

        return TypedResults.Ok(AdminProductQueries.ToDto(product));
    }
}
