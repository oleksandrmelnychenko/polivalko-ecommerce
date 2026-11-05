using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Attributes;

internal static class DeleteAttributeDefinition
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        IAuditLog audit,
        CancellationToken ct)
    {
        var definition = await db.Set<AttributeDefinition>().FirstOrDefaultAsync(d => d.Id == id, ct);
        if (definition is null)
        {
            return AttributeDefinitionEditor.NotFound();
        }

        var categoryCount = await AttributeUsage.CategoriesUsingAsync(db, definition.NormalizedName, ct);
        if (categoryCount > 0)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "attributes.in_filters",
                "Характеристика використовується у фільтрах",
                $"Спершу приберіть її з фільтрів категорій ({categoryCount}).",
                [new("categoryCount", categoryCount)]);
        }

        db.Remove(definition);
        audit.Record("catalog.attribute_deleted", "Attribute", definition.Name);
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }
}
