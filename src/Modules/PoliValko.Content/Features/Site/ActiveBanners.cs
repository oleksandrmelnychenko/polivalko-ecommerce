using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.Site;

internal sealed class ActiveBanners(PoliValkoDbContext db, IMemoryCache cache)
{
    private const string CacheKey = "content:banners:active";

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(1);

    public async Task<IReadOnlyList<HomeBannerDto>> GetLiveAsync(DateTimeOffset now, CancellationToken ct)
    {
        if (!cache.TryGetValue(CacheKey, out IReadOnlyList<Banner>? active) || active is null)
        {
            active = await db.Set<Banner>()
                .AsNoTracking()
                .Where(b => b.IsActive)
                .OrderBy(b => b.SortOrder)
                .ThenBy(b => b.Title)
                .ToListAsync(ct);
            cache.Set(CacheKey, active, CacheDuration);
        }

        return active.Where(b => b.IsLive(now)).Select(BannerEditor.ToHomeDto).ToList();
    }

    public void Invalidate() => cache.Remove(CacheKey);
}
