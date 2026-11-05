using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.SiteContent;

internal static class ListPages
{
    public static async Task<Ok<List<ConsolePageListItemDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await db.Set<ContentPage>()
            .AsNoTracking()
            .OrderBy(p => p.Title)
            .Select(p => new ConsolePageListItemDto(p.Slug, p.Title, p.UpdatedAt, p.UpdatedBy, p.SeoTitle, p.SeoDescription))
            .ToListAsync(ct));
}
