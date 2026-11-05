using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Attributes;

internal static class ListAttributeDefinitions
{
    public static async Task<Ok<List<AttributeDefinitionDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var definitions = await db.Set<AttributeDefinition>().AsNoTracking().OrderBy(d => d.SortOrder).ThenBy(d => d.Name).ToListAsync(ct);
        var usage = await AttributeUsage.LoadAsync(db, ct);
        return TypedResults.Ok(definitions.Select(d => AttributeDefinitionEditor.ToDto(d, usage)).ToList());
    }
}
