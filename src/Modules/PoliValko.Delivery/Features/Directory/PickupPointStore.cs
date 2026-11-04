using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Delivery.Contracts;
using PoliValko.Delivery.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Delivery.Features.Directory;

internal sealed class PickupPointStore(PoliValkoDbContext db, IMemoryCache cache)
{
    private const string CacheKey = "delivery:pickup-points:active";

    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(1);

    public async ValueTask<IReadOnlyList<PickupPoint>> GetActiveAsync(CancellationToken ct)
    {
        if (cache.TryGetValue(CacheKey, out IReadOnlyList<PickupPoint>? cached) && cached is not null)
        {
            return cached;
        }

        var points = await db.Set<PickupLocation>()
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.Code)
            .Select(p => new PickupPoint(p.Code, p.Name, p.Address, p.Schedule, p.Instructions, p.MapUrl))
            .ToListAsync(ct);
        IReadOnlyList<PickupPoint> result = points.AsReadOnly();
        cache.Set(CacheKey, result, CacheDuration);
        return result;
    }

    public async ValueTask<PickupPoint> GetDefaultAsync(CancellationToken ct) =>
        (await GetActiveAsync(ct)).FirstOrDefault()
        ?? throw new InvalidOperationException("Немає жодної активної точки самовивозу: увімкніть її в консолі.");

    public void Invalidate() => cache.Remove(CacheKey);
}
