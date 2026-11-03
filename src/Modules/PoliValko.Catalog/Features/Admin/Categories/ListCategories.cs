using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Admin.Categories;

internal static class ListCategories
{
    public static async Task<Ok<List<AdminCategoryDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var counts = await db.Set<Product>().GroupBy(p => p.CategoryId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var categories = await db.Set<Category>().AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        return TypedResults.Ok(categories.Select(c => CategoryEditor.ToDto(c, counts.GetValueOrDefault(c.Id))).ToList());
    }
}
