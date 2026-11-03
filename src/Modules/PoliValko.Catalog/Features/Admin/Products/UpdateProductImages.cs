using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Admin.Products;

internal static class UpdateProductImages
{
    public static async Task<Results<Ok<AdminProductDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        UpdateProductImagesRequest request,
        PoliValkoDbContext db,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var product = await AdminProductQueries.LoadProductAsync(db, id, tracking: true, ct);
        if (product is null)
        {
            return AdminProductQueries.ProductNotFound();
        }

        var order = request.Images ?? [];
        if (order.Count != product.Images.Count || order.Select(i => i.Id).Distinct().Count() != order.Count
            || order.Any(i => product.Images.All(x => x.Id != i.Id)))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["images"] = ["Передайте всі фото товару рівно один раз."] });
        }

        for (var i = 0; i < order.Count; i++)
        {
            var image = product.Images.Single(x => x.Id == order[i].Id);
            image.SortOrder = i;
            if (!string.IsNullOrWhiteSpace(order[i].Alt))
            {
                var altText = order[i].Alt!.Trim();
                image.Alt = altText.Length > 300 ? altText[..300] : altText;
            }
        }

        product.UpdatedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(AdminProductQueries.ProductTags(product.Slug), ct);
        return TypedResults.Ok(AdminProductQueries.ToDto(product));
    }
}
