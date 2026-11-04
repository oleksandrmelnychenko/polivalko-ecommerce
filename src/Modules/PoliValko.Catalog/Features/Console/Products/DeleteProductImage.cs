using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class DeleteProductImage
{
    public static async Task<Results<Ok<ConsoleProductDto>, ProblemHttpResult>> HandleAsync(
        Guid id,
        Guid imageId,
        PoliValkoDbContext db,
        IMediaStorage media,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var product = await ConsoleProductQueries.LoadProductAsync(db, id, tracking: true, ct);
        var image = product?.Images.FirstOrDefault(i => i.Id == imageId);
        if (product is null || image is null)
        {
            return Problems.NotFound("catalog.image_not_found", "Фото не знайдено");
        }

        product.Images.Remove(image);
        db.Remove(image);
        product.UpdatedAt = time.GetUtcNow();
        audit.Record("catalog.product_image_deleted", "Product", product.Sku, new { image.Url });
        await db.SaveChangesAsync(ct);
        await media.DeleteAsync(image.Url, ct);
        await storefront.InvalidateAsync(ConsoleProductQueries.ProductTags(product.Slug), ct);
        return TypedResults.Ok(ConsoleProductQueries.ToDto(product));
    }
}
