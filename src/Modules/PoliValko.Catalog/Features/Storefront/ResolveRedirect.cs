using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Storefront;

internal static class ResolveRedirect
{
    public static async Task<Results<Ok<RedirectDto>, ProblemHttpResult>> HandleAsync(string? path, PoliValkoDbContext db, CancellationToken ct)
    {
        var from = path?.Trim();
        var redirect = string.IsNullOrEmpty(from)
            ? null
            : await db.Set<UrlRedirect>().AsNoTracking().FirstOrDefaultAsync(r => r.FromPath == from, ct);
        return redirect is null
            ? Problems.NotFound("catalog.redirect_not_found", "Перенаправлення немає")
            : TypedResults.Ok(new RedirectDto(redirect.FromPath, redirect.ToPath));
    }
}
