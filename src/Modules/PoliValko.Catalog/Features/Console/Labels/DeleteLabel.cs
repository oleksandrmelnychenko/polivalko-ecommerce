using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Labels;

internal static class DeleteLabel
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var label = await db.Set<ProductLabel>().FirstOrDefaultAsync(l => l.Id == id, ct);
        if (label is null)
        {
            return LabelEditor.NotFound();
        }

        if (label.Kind != LabelKind.Manual && label.IsActive)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "labels.auto_active",
                "Автоматична мітка ввімкнена",
                "Спершу вимкніть мітку, потім видаліть її.");
        }

        db.Remove(label);
        audit.Record("catalog.label_deleted", "Label", label.Name, new { label.Kind });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(LabelEditor.StorefrontTagsToInvalidate, ct);
        return TypedResults.NoContent();
    }
}
