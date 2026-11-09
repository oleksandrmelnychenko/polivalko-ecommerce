using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.SiteContent;

internal static class GetPage
{
    public static Task<Results<Ok<PageDto>, ProblemHttpResult>> HandleAsync(string slug, PoliValkoDbContext db, CancellationToken ct) =>
        ReadAsync(slug, db, includeEditor: false, ct);

    public static Task<Results<Ok<PageDto>, ProblemHttpResult>> ConsoleAsync(string slug, PoliValkoDbContext db, CancellationToken ct) =>
        ReadAsync(slug, db, includeEditor: true, ct);

    private static async Task<Results<Ok<PageDto>, ProblemHttpResult>> ReadAsync(string slug, PoliValkoDbContext db, bool includeEditor, CancellationToken ct)
    {
        var page = await db.Set<ContentPage>().AsNoTracking().FirstOrDefaultAsync(p => p.Slug == slug, ct);
        if (page is null) return SiteContentMapping.PageNotFound();
        var dto = SiteContentMapping.ToDto(page);
        return TypedResults.Ok(includeEditor ? dto : dto with { UpdatedBy = null });
    }
}
