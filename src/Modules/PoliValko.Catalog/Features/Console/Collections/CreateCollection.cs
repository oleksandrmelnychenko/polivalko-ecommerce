using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Console.Collections;

internal static class CreateCollection
{
    public static async Task<Results<Created<ConsoleCollectionDto>, ValidationProblem>> HandleAsync(
        SaveCollectionRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var collection = new HomeCollection { Id = Guid.CreateVersion7(), Code = string.Empty, Title = string.Empty };
        var errors = await CollectionEditor.ApplyCollectionAsync(collection, request, db, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        db.Add(collection);
        audit.Record("catalog.collection_created", "Collection", collection.Code, new { collection.Title, products = collection.ProductIds.Count });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Collections], ct);
        var products = await ConsoleProductQueries.LoadListItemsAsync(db, collection.ProductIds, time.GetUtcNow(), ct);
        return TypedResults.Created($"/api/v1/console/catalog/collections/{collection.Id}", CollectionEditor.ToDto(collection, products));
    }
}
