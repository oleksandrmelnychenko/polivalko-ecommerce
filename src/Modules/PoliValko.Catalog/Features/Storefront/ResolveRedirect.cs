using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Redirects;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Storefront;

internal static class ResolveRedirect
{
    public static async Task<Results<Ok<RedirectDto>, ProblemHttpResult>> HandleAsync(string? path, PoliValkoDbContext db, CancellationToken ct)
    {
        var from = RedirectWriter.NormalizePath(path);
        var legacyFrom = path?.Trim();
        var redirect = string.IsNullOrEmpty(from)
            ? null
            : await db.Set<UrlRedirect>().AsNoTracking()
                .Where(r => r.FromPath == from || r.FromPath == legacyFrom)
                .OrderByDescending(r => r.FromPath == from)
                .FirstOrDefaultAsync(ct);
        var target = RedirectWriter.NormalizePath(redirect?.ToPath);
        return redirect is null || target is null
            ? Problems.NotFound("catalog.redirect_not_found", "Перенаправлення немає")
            : TypedResults.Ok(new RedirectDto(redirect.FromPath, target));
    }
}
