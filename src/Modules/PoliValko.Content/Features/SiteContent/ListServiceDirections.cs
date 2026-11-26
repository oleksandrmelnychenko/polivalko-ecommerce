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
            .Select((d, i) => ToDto(d, content.GetValueOrDefault(d.Code), i + 1))
            .OrderBy(d => d.SortOrder)
            .ToList());
    }

    public static ConsoleServiceDirectionDto ToDto(ServiceDirection direction, ServiceDirectionContent? content, int defaultOrder) => new(
        direction.Code,
        direction.Name,
        content?.Description,
        content?.SortOrder ?? defaultOrder,
        content?.IsVisible ?? true,
        content?.ImageUrl,
        ServiceDirections.SlugOf(direction, content),
        direction.Slug,
        content?.BodyHtml,
        content?.SeoTitle,
        content?.SeoDescription,
        content?.UpdatedAt);
}
