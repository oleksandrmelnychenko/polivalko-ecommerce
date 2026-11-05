using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.AttributeNames;

internal static class ListAttributeNames
{
    public static async Task<Ok<List<AttributeNameDto>>> HandleAsync(Guid? categoryId, PoliValkoDbContext db, CancellationToken ct)
    {
        var attributes = db.Set<Product>().AsNoTracking();
        if (categoryId is { } id)
        {
            var categories = await db.Set<Category>().AsNoTracking().Select(c => new { c.Id, c.ParentId }).ToListAsync(ct);
            var ids = new HashSet<Guid> { id };
            for (var added = true; added;)
            {
                added = false;
                foreach (var c in categories.Where(c => c.ParentId is { } parent && ids.Contains(parent)))
                {
                    added |= ids.Add(c.Id);
                }
            }

            attributes = attributes.Where(p => ids.Contains(p.CategoryId));
        }

        var pairs = await attributes
            .SelectMany(p => p.Attributes)
            .Select(a => new { a.Name, a.ProductId })
            .Distinct()
            .ToListAsync(ct);
        var used = pairs
            .GroupBy(a => a.Name)
            .Select(g => new AttributeNameDto(g.Key, g.Count()))
            .ToList();
        var seen = used.Select(a => AttributeDefinition.Normalize(a.Name)).ToHashSet(StringComparer.Ordinal);
        var dictionary = await db.Set<AttributeDefinition>().AsNoTracking().OrderBy(d => d.SortOrder).Select(d => new { d.Name, d.NormalizedName }).ToListAsync(ct);
        var names = used
            .Concat(dictionary.Where(d => seen.Add(d.NormalizedName)).Select(d => new AttributeNameDto(d.Name, 0)))
            .OrderByDescending(a => a.ProductCount)
            .ThenBy(a => a.Name, StringComparer.InvariantCulture)
            .ToList();
        return TypedResults.Ok(names);
    }
}
