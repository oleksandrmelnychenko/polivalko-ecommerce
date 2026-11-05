using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Catalog.Features.Console.Attributes;

internal static class UpdateAttributeDefinition
{
    public static async Task<Results<Ok<AttributeDefinitionDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        Guid id,
        SaveAttributeDefinitionRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        var definition = await db.Set<AttributeDefinition>().FirstOrDefaultAsync(d => d.Id == id, ct);
        if (definition is null)
        {
            return AttributeDefinitionEditor.NotFound();
        }

        var before = new { definition.Name, definition.Unit, definition.Kind, definition.FilterView, Aliases = definition.Aliases.ToList() };
        var oldNormalized = definition.NormalizedName;
        var errors = await AttributeDefinitionEditor.ApplyAsync(definition, request, db, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var renamed = !string.Equals(before.Name, definition.Name, StringComparison.Ordinal);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var products = 0;
        var categories = 0;
        if (renamed)
        {
            var name = definition.Name;
            products = await db.Set<ProductAttribute>()
                .Where(a => a.Name.Trim().ToUpper() == oldNormalized)
                .ExecuteUpdateAsync(s => s.SetProperty(a => a.Name, name), ct);
            var withFilters = await db.Set<Category>().Where(c => c.FilterAttributes != null).ToListAsync(ct);
            foreach (var category in withFilters.Where(c => c.FilterAttributes!.Any(f => AttributeDefinition.Normalize(f) == oldNormalized)))
            {
                category.FilterAttributes = category.FilterAttributes!
                    .Select(f => AttributeDefinition.Normalize(f) == oldNormalized ? name : f)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                categories++;
            }
        }

        audit.Record(renamed ? "catalog.attribute_renamed" : "catalog.attribute_updated", "Attribute", definition.Name, new
        {
            before,
            after = new { definition.Name, definition.Unit, definition.Kind, definition.FilterView, definition.Aliases },
            products,
            categories,
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Categories, StorefrontTags.Products], ct);
        return TypedResults.Ok(await AttributeDefinitionEditor.ToDtoAsync(db, definition, ct));
    }
}
