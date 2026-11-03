using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.SiteContent;

internal static class GetPage
{
    public static async Task<Results<Ok<PageDto>, ProblemHttpResult>> HandleAsync(string slug, PoliValkoDbContext db, CancellationToken ct)
    {
        var page = await db.Set<ContentPage>().AsNoTracking().FirstOrDefaultAsync(p => p.Slug == slug, ct);
        return page is null ? SiteContentMapping.PageNotFound() : TypedResults.Ok(SiteContentMapping.ToDto(page));
    }
}
