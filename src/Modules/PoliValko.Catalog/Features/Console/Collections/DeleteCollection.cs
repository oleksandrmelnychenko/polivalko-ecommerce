using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Collections;

internal static class DeleteCollection
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
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

        db.Remove(collection);
        audit.Record("catalog.collection_deleted", "Collection", collection.Code, new { collection.Title });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Collections], ct);
        return TypedResults.NoContent();
    }
}
