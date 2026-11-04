using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Redirects;

internal static class CreateRedirect
{
    public static async Task<Results<Created<ConsoleRedirectDto>, ValidationProblem>> HandleAsync(
        CreateRedirectRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var from = RedirectWriter.NormalizePath(request.FromPath);
        var to = RedirectWriter.NormalizePath(request.ToPath);
        if (from is null)
        {
            errors["fromPath"] = ["Вкажіть шлях без домену, що починається з /, напр. /product/stara-adresa."];
        }

        if (to is null)
        {
            errors["toPath"] = ["Вкажіть шлях без домену, що починається з /."];
        }
        else if (from == to)
        {
            errors["toPath"] = ["Нова адреса збігається зі старою."];
        }

        if (from is not null && await db.Set<UrlRedirect>().AnyAsync(r => r.FromPath == from, ct))
        {
            errors["fromPath"] = ["Для цієї адреси вже є перенаправлення."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var redirect = new UrlRedirect { Id = Guid.CreateVersion7(), FromPath = from!, ToPath = to!, CreatedAt = time.GetUtcNow() };
        db.Add(redirect);
        audit.Record("catalog.redirect_created", "Redirect", from, new { to });
        await db.SaveChangesAsync(ct);
        return TypedResults.Created($"/api/v1/console/catalog/redirects/{redirect.Id}", new ConsoleRedirectDto(redirect.Id, redirect.FromPath, redirect.ToPath, false, redirect.CreatedAt));
    }
}
