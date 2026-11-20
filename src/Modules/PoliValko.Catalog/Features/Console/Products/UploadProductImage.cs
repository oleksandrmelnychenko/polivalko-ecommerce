using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class UploadProductImage
{
    public static async Task<Results<Ok<ConsoleProductDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        IFormFile file,
        [FromForm] string? alt,
        PoliValkoDbContext db,
        ProductPhotoStorage media,
        ILogger<ProductPhotoStorage> logger,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM catalog.products WHERE id = {id} FOR UPDATE", ct);
        var product = await ConsoleProductQueries.LoadProductAsync(db, id, tracking: true, ct);
        if (product is null)
        {
            return ConsoleProductQueries.ProductNotFound();
        }

        if (product.IsArchived)
        {
            return TypedResults.Problem(statusCode: 409, detail: "Спершу відновіть товар з архіву.");
        }

        if (product.Images.Count >= 20)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = ["Не більше 20 фото в товару."] });
        }

        StoredMedia stored;
        try
        {
            await using var stream = file.OpenReadStream();
            stored = await media.SaveAsync(stream, ct);
        }
        catch (MediaValidationException ex)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [ex.Message] });
        }
        catch (ProductPhotoStorageException ex)
        {
            logger.LogWarning("Could not upload catalog photo: {Reason}", ex.Message);
            return Problems.Create(StatusCodes.Status503ServiceUnavailable, "catalog.photo_storage_unavailable",
                "Збереження фото тимчасово недоступне", "Спробуйте ще раз за кілька хвилин.");
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
        if (!product.Images.Contains(image))
        {
            product.Images.Add(image);
        }
        product.UpdatedAt = now;
        audit.Record("catalog.product_image_added", "Product", product.Sku, new { image.Url });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await storefront.InvalidateAsync(ConsoleProductQueries.ProductTags, ct);

        return TypedResults.Ok(await ConsoleProductQueries.ToDtoAsync(db, product, time.GetUtcNow(), ct));
    }
}
