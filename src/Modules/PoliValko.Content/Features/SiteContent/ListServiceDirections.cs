using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.SiteContent;

internal static class ListServiceDirections
{
    public static async Task<Ok<List<ConsoleServiceDirectionDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var content = await db.Set<ServiceDirectionContent>().AsNoTracking().ToDictionaryAsync(d => d.Code, ct);
        return TypedResults.Ok(ServiceDirections.All
            .Select((d, i) => content.TryGetValue(d.Code, out var c)
                ? new ConsoleServiceDirectionDto(d.Code, d.Name, c.Description, c.SortOrder, c.IsVisible)
                : new ConsoleServiceDirectionDto(d.Code, d.Name, null, i + 1, true))
            .OrderBy(d => d.SortOrder)
            .ToList());
    }
}
