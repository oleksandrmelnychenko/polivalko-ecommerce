using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Redirects;

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
        if (value is null || value.Any(c => char.IsControl(c) || c == '\\')) return null;
        var path = value.Trim();
        if (path.Length is < 2 or > 500 || !path.StartsWith('/') || path.StartsWith("//", StringComparison.Ordinal)
            || path.Contains("://", StringComparison.Ordinal)) return null;
        var origin = new Uri("https://polivalko.invalid");
        if (!Uri.TryCreate(origin, path, out var url) || url.Scheme != origin.Scheme || url.Authority != origin.Authority) return null;
        var local = url.PathAndQuery + url.Fragment;
        return local.StartsWith("//", StringComparison.Ordinal) ? null : local.TrimEnd('/');
    }
}
