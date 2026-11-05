using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Attributes;

internal static class CreateAttributeDefinition
{
    public static async Task<Results<Created<AttributeDefinitionDto>, ValidationProblem>> HandleAsync(
        SaveAttributeDefinitionRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        CancellationToken ct)
    {
        var definition = new AttributeDefinition { Id = Guid.CreateVersion7(), Kind = AttributeKind.List, FilterView = AttributeFilterView.Checkboxes };
        var errors = await AttributeDefinitionEditor.ApplyAsync(definition, request, db, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        db.Add(definition);
        audit.Record("catalog.attribute_created", "Attribute", definition.Name, new { definition.Unit, definition.Kind, definition.FilterView, definition.Aliases });
        await db.SaveChangesAsync(ct);
        return TypedResults.Created(
            $"/api/v1/console/catalog/attributes/{definition.Id}",
            await AttributeDefinitionEditor.ToDtoAsync(db, definition, ct));
    }
}
