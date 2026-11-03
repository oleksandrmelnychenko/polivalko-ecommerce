using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Admin.Redirects;

internal static class ListRedirects
{
    public static async Task<Ok<List<AdminRedirectDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await db.Set<UrlRedirect>()
            .AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new AdminRedirectDto(r.Id, r.FromPath, r.ToPath, r.IsAutomatic, r.CreatedAt))
            .ToListAsync(ct));
}
