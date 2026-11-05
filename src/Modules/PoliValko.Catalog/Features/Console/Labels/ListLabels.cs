using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Labels;

internal static class ListLabels
{
    public static async Task<Ok<List<LabelDto>>> HandleAsync(PoliValkoDbContext db, TimeProvider time, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var labels = await db.Set<ProductLabel>().AsNoTracking().OrderBy(l => l.SortOrder).ThenBy(l => l.Name).ToListAsync(ct);
        var links = await db.Set<ProductLabelLink>().GroupBy(l => l.LabelId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var result = new List<LabelDto>(labels.Count);
        foreach (var label in labels)
        {
            var count = label.Kind == LabelKind.Manual ? links.GetValueOrDefault(label.Id) : await LabelEditor.CountProductsAsync(db, label, now, ct);
            result.Add(LabelEditor.ToDto(label, count));
        }

        return TypedResults.Ok(result);
    }
}
