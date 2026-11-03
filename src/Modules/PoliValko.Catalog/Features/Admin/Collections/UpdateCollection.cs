using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Admin.Products;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Admin.Collections;

internal static class UpdateCollection
{
    public static async Task<Results<Ok<AdminCollectionDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        SaveCollectionRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var collection = await db.Set<HomeCollection>().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (collection is null)
        {
            return Problems.NotFound("catalog.collection_not_found", "Добірку не знайдено");
        }

        var errors = await CollectionEditor.ApplyCollectionAsync(collection, request, db, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        audit.Record("catalog.collection_updated", "Collection", collection.Code, new { collection.Title, collection.IsVisible, products = collection.ProductIds.Count });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Collections], ct);
        var products = await AdminProductQueries.LoadListItemsAsync(db, collection.ProductIds, ct);
        return TypedResults.Ok(CollectionEditor.ToDto(collection, products));
    }
}
