using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Console.Labels;

internal static class UpdateLabel
{
    public static async Task<Results<Ok<LabelDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        SaveLabelRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var label = await db.Set<ProductLabel>().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (label is null)
        {
            return LabelEditor.NotFound();
        }

        var before = new { label.Name, label.Tone, label.NewDays, label.SortOrder, label.IsActive };
        var errors = LabelEditor.Apply(label, request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        audit.Record("catalog.label_updated", "Label", label.Name, new
        {
            before,
            after = new { label.Name, label.Tone, label.NewDays, label.SortOrder, label.IsActive },
        });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(LabelEditor.StorefrontTagsToInvalidate, ct);
        return TypedResults.Ok(await LabelEditor.ToDtoAsync(db, label, time.GetUtcNow(), ct));
    }
}
