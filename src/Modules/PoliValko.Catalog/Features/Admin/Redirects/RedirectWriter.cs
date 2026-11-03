using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Admin.Redirects;

internal static class RedirectWriter
{
    public static async Task AddRedirectAsync(PoliValkoDbContext db, string from, string to, DateTimeOffset now, CancellationToken ct)
    {
        await db.Set<UrlRedirect>().Where(r => r.FromPath == to).ExecuteDeleteAsync(ct);
        await db.Set<UrlRedirect>().Where(r => r.ToPath == from).ExecuteUpdateAsync(s => s.SetProperty(r => r.ToPath, to), ct);
        if (!await db.Set<UrlRedirect>().AnyAsync(r => r.FromPath == from, ct))
        {
            db.Add(new UrlRedirect { Id = Guid.CreateVersion7(now), FromPath = from, ToPath = to, IsAutomatic = true, CreatedAt = now });
        }
    }

    public static string? NormalizePath(string? value)
    {
        var path = value?.Trim();
        return path is { Length: > 1 and <= 500 } && path.StartsWith('/') && !path.StartsWith("//", StringComparison.Ordinal) && !path.Contains("://", StringComparison.Ordinal)
            ? path.TrimEnd('/')
            : null;
    }
}
