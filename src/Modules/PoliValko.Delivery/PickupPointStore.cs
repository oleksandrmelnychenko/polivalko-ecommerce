using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Delivery.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Delivery;

/// <summary>
/// Активні точки самовивозу з БД. Їх читає кожне оформлення замовлення, тому список коротко
/// кешується в пам'яті процесу; зміна в адмінці скидає кеш одразу (інші процеси — за хвилину).
/// </summary>
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

    /// <summary>Точка для самовивозу в замовленні — перша активна. Адмінка не дає вимкнути останню.</summary>
    public async ValueTask<PickupPoint> GetDefaultAsync(CancellationToken ct) =>
        (await GetActiveAsync(ct)).FirstOrDefault()
        ?? throw new InvalidOperationException("Немає жодної активної точки самовивозу: увімкніть її в адмінці.");

    public void Invalidate() => cache.Remove(CacheKey);
}
