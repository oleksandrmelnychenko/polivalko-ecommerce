using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Console.Labels;

internal static class CreateLabel
{
    public static async Task<Results<Created<LabelDto>, ValidationProblem>> HandleAsync(
        SaveLabelRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        var label = new ProductLabel { Id = Guid.CreateVersion7(), Name = string.Empty, Kind = request.Kind ?? LabelKind.Manual };
        var errors = LabelEditor.Apply(label, request);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        db.Add(label);
        audit.Record("catalog.label_created", "Label", label.Name, new { label.Kind, label.Tone, label.NewDays, label.IsActive });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(LabelEditor.StorefrontTagsToInvalidate, ct);
        return TypedResults.Created($"/api/v1/console/catalog/labels/{label.Id}", await LabelEditor.ToDtoAsync(db, label, time.GetUtcNow(), ct));
    }
}
