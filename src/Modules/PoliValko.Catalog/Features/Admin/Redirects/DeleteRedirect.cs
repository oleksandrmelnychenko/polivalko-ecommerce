using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Admin.Redirects;

internal static class DeleteRedirect
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(Guid id, PoliValkoDbContext db, IAuditLog audit, CancellationToken ct)
    {
        var redirect = await db.Set<UrlRedirect>().FirstOrDefaultAsync(r => r.Id == id, ct);
        if (redirect is null)
        {
            return Problems.NotFound("catalog.redirect_not_found", "Перенаправлення не знайдено");
        }

        db.Remove(redirect);
        audit.Record("catalog.redirect_deleted", "Redirect", redirect.FromPath, new { redirect.ToPath });
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }
}
