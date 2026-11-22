using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal sealed class SeasonalMerchandising(IMemoryCache cache) : IDisposable
{
    private readonly SemaphoreSlim _refresh = new(1, 1);

    internal static string[] PriorityCategories(DateOnly day) => day.Month switch
    {
        11 or 12 => ["novyi-rik", "Обігрівачі", "Годівниці", "Укривні матеріали"],
        1 => ["Обігрівачі", "Годівниці", "Насіння", "Грунти та добавки"],
        2 or 3 => ["Насіння", "Грунти та добавки", "Горщики", "Укривні матеріали", "Гілкорізи/Сучкорізи/Секатори/Ножиці"],
        4 or 5 => ["vse-dlia-roslyn", "vse-dlia-polyvu", "Композитні грядки"],
        6 or 7 or 8 => ["vse-dlia-polyvu", "vse-dlia-vidpochynku", "Хімія для басейнів"],
        _ => ["Гілкорізи/Сучкорізи/Секатори/Ножиці", "Насіння газонних трав", "Укривні матеріали", "Септик/Компост", "Все для прибирання"],
    };

    public async Task<IQueryable<Product>> SortAsync(IQueryable<Product> products, IReadOnlyList<Category> categories,
        string? term, PoliValkoDbContext db, DateOnly today, CancellationToken ct)
    {
        var priority = PriorityCategories(today);
        var byParent = categories.ToLookup(c => c.ParentId);
        var seasonal = categories.Where(c => priority.Contains(c.Slug) || priority.Contains(c.Name))
            .SelectMany(c => CategoryQueries.Descendants(c.Id, byParent).Prepend(c.Id)).Distinct().ToArray();
        var rankedIds = await DemandAsync(db, today, ct);
        var ranks = db.Database.SqlQuery<DemandRank>($"""
            SELECT id AS product_id, position AS rank FROM unnest({rankedIds}::uuid[]) WITH ORDINALITY AS r(id,position)
            """);
        return from p in products
               join r in ranks on p.Id equals r.ProductId into demand
               from rank in demand.DefaultIfEmpty()
               orderby (term != null && p.Sku == term) descending,
                   (p.Stock.Quantity - p.Stock.ReservedQuantity >= 1 && p.Price.Amount > 0) descending,
                   seasonal.Contains(p.CategoryId) descending, ((long?)rank.Rank ?? long.MaxValue),
                   p.Images.Any() descending, (p.DisplayName ?? p.Name), p.Id
               select p;
    }

    private sealed record DemandRank(Guid ProductId, long Rank);

    private async Task<Guid[]> DemandAsync(PoliValkoDbContext db, DateOnly today, CancellationToken ct)
    {
        var key = ("storefront-seasonal-demand", today);
        if (cache.TryGetValue<Guid[]>(key, out var saved) && saved is not null) return saved;
        await _refresh.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue<Guid[]>(key, out saved) && saved is not null) return saved;
            var lastYear = today.AddYears(-1);
            var twoYearsAgo = today.AddYears(-2);
            var recent = today.AddDays(-27);
            // Count distinct purchase occasions, so a bulk purchase or repeated receipt line cannot dominate.
            var ids = await db.Database.SqlQuery<Guid>($"""
                WITH receipts AS (
                    SELECT DISTINCT d.id, d.day, line->'product'->>'code' AS code
                    FROM accounting.documents d
                    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
                        THEN d.details->'products' ELSE '[]'::jsonb END) line
                    WHERE d.entity_type='receipt' AND d.kind='cash' AND d.status='active'
                        AND d.source_account='valko-dntrade' AND d.total>0
                        AND (d.day BETWEEN {recent} AND {today}
                            OR d.day BETWEEN {lastYear.AddDays(-21)} AND {lastYear.AddDays(21)}
                            OR d.day BETWEEN {twoYearsAgo.AddDays(-21)} AND {twoYearsAgo.AddDays(21)})
                        AND CASE WHEN line->>'quantity' ~ '^[0-9]+([.][0-9]+)?$'
                            THEN (line->>'quantity')::numeric > 0 ELSE false END
                ), signals AS (
                    SELECT p.id, CASE WHEN r.day >= {recent} THEN 1
                        WHEN r.day >= {lastYear.AddDays(-21)} THEN 3 ELSE 2 END AS weight, r.id AS purchase_id
                    FROM receipts r JOIN catalog.products p ON p.navkolo_id='dntrade-code:'||r.code
                    UNION ALL
                    SELECT DISTINCT i.product_id, 1 AS weight, o.id
                    FROM ordering.orders o JOIN ordering.order_items i ON i.order_id=o.id
                    WHERE o.created_at >= {KyivTime.StartOfDay(recent)} AND o.created_at < {KyivTime.StartOfDay(today.AddDays(1))}
                        AND o.status IN ('Confirmed','Paid','Shipped','ReadyForPickup','Completed')
                )
                SELECT id AS "Value" FROM signals GROUP BY id ORDER BY sum(weight) DESC, id
                """).ToArrayAsync(ct);
            return cache.Set(key, ids, TimeSpan.FromHours(1));
        }
        finally { _refresh.Release(); }
    }

    public void Dispose() => _refresh.Dispose();
}
