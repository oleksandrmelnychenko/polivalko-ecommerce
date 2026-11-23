using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal sealed class SeasonalMerchandising(IMemoryCache cache) : IDisposable
{
    private readonly SemaphoreSlim _refresh = new(1, 1);
    private const string PlantCovers = "Укривні матеріали";

    internal static string[] PriorityCategories(DateOnly day) => day.Month switch
    {
        11 or 12 => ["novyi-rik", "Обігрівачі", "Годівниці", PlantCovers],
        1 => ["Обігрівачі", "Годівниці", "Насіння", "Грунти та добавки"],
        2 or 3 => ["Насіння", "Грунти та добавки", "Горщики", PlantCovers, "Гілкорізи/Сучкорізи/Секатори/Ножиці"],
        4 or 5 => ["vse-dlia-roslyn", "vse-dlia-polyvu", "Композитні грядки"],
        6 or 7 or 8 => ["vse-dlia-polyvu", "vse-dlia-vidpochynku", "Хімія для басейнів"],
        _ => ["Гілкорізи/Сучкорізи/Секатори/Ножиці", "Насіння газонних трав", PlantCovers, "Септик/Компост", "Все для прибирання"],
    };

    public async Task<IQueryable<Product>> SortAsync(IQueryable<Product> products, IReadOnlyList<Category> categories,
        string? term, PoliValkoDbContext db, DateOnly today, CancellationToken ct, string mode = ProductSort.Seasonal,
        bool acrossCategories = true, Guid[]? pinned = null, DateOnly? seasonDate = null)
    {
        var season = seasonDate ?? today;
        var priority = PriorityCategories(season);
        var byParent = categories.ToLookup(c => c.ParentId);
        Guid[] Family(string key) => categories.Where(c => c.Slug == key || c.Name == key)
            .SelectMany(c => CategoryQueries.Descendants(c.Id, byParent).Prepend(c.Id)).Distinct().ToArray();
        var seasonalMode = mode == ProductSort.Seasonal;
        var seasonal = seasonalMode ? [] : priority.SelectMany(Family).Distinct().ToArray();
        // The other two modes rank by section, not by rule.
        var matches = seasonalMode ? await SeasonalPurpose.LoadAsync(db, cache, categories, ct) : new SeasonalPurpose.RuleMatches([], []);
        var purposes = SeasonalPurpose.Query(db, matches, categories, season);
        var signals = await DemandAsync(db, today, season, ct);
        var ids = signals.Select(s => s.ProductId).ToArray();
        var trends = signals.Select(s => Math.Max(0, s.Week - s.Previous / 3m) * s.Week / (s.Week + 3m)).ToArray();
        var units = signals.Select(s => s.Units).ToArray();
        var demandScores = signals.Select(s => s.Demand).ToArray();
        var ranks = db.Database.SqlQuery<DemandRank>($"""
            SELECT id AS product_id, demand, trend, units
            FROM unnest({ids}::uuid[], {demandScores}::bigint[], {trends}::numeric[], {units}::numeric[]) AS r(id,demand,trend,units)
            """);
        var measuredSince = KyivTime.StartOfDay(today.AddDays(-28));
        var scored = from p in products
               join r in ranks on p.Id equals r.ProductId into demand
               from rank in demand.DefaultIfEmpty()
               join m in purposes.Rows on p.Id equals m.ProductId into classified
               from match in classified.DefaultIfEmpty()
               let available = p.Stock.Quantity - p.Stock.ReservedQuantity
               let sold = (decimal?)rank.Units
               // Zero sales count as slow movement only for established items with several units available.
               let cover = sold > 0 ? 28m * available / sold :
                   ((rank.ProductId == null || sold == 0) && available >= 3 && p.CreatedAt < measuredSince ? 3650m : 0m)
               select new { p, available, trend = (decimal?)rank.Trend ?? 0m, cover,
                   seasonal = seasonalMode ? match.Family != null : seasonal.Contains(p.CategoryId),
                   family = match.Family ?? -1,
                   demand = (long?)rank.Demand ?? 0L };
        Guid[] leaders = [];
        Guid? monthlyLeader = null;
        var automaticListing = seasonalMode && acrossCategories && string.IsNullOrWhiteSpace(term);
        if (automaticListing)
            monthlyLeader = await MonthlySalesLeader.PickAsync(products, matches, db, cache, today, season.Month, ct);
        if (automaticListing && purposes.Families > 1)
        {
            var candidates = scored.Where(s => s.seasonal && s.available >= 1 && s.p.Price.Amount > 0)
                .OrderByDescending(s => s.demand).ThenByDescending(s => s.p.Images.Any())
                .ThenBy(s => s.p.DisplayName ?? s.p.Name).ThenBy(s => s.p.Id)
                .Select(s => new Candidate(s.p.Id, s.family));
            leaders = await LeadingProductsAsync(candidates, purposes.Families, ct);
        }
        var first = scored.OrderByDescending(s => term != null && s.p.Sku == term);
        if (pinned is { Length: > 0 })
            first = first.ThenByDescending(s => pinned.Contains(s.p.Id)).ThenBy(s => Array.IndexOf(pinned, s.p.Id));
        first = first.ThenByDescending(s => s.available >= 1 && s.p.Price.Amount > 0);
        if (monthlyLeader is { } leader) first = first.ThenByDescending(s => s.p.Id == leader);
        var ordered = mode switch
        {
            ProductSort.Trending => first.ThenByDescending(s => s.trend).ThenByDescending(s => s.seasonal),
            ProductSort.StockCover => first.ThenByDescending(s => s.cover >= 56).ThenByDescending(s => s.seasonal)
                .ThenByDescending(s => s.cover),
            ProductSort.Seasonal when leaders.Length > 0 => first.ThenByDescending(s => leaders.Contains(s.p.Id))
                .ThenBy(s => Array.IndexOf(leaders, s.p.Id)).ThenByDescending(s => s.seasonal),
            _ => first.ThenByDescending(s => s.seasonal),
        };
        return ordered.ThenByDescending(s => s.demand).ThenByDescending(s => s.p.Images.Any())
            .ThenBy(s => s.p.DisplayName ?? s.p.Name).ThenBy(s => s.p.Id).Select(s => s.p);
    }

    private sealed record Candidate(Guid Id, int Family);
    private sealed record DemandRank(Guid? ProductId, long Demand, decimal Trend, decimal? Units);
    private sealed record ProductSignal(Guid ProductId, long Demand, int Week, int Previous, decimal? Units);

    private static async Task<Guid[]> LeadingProductsAsync(IQueryable<Candidate> candidates, int families, CancellationToken ct)
    {
        const int slots = 12;
        var heads = Enumerable.Range(0, families).Select(_ => new Queue<(Guid Id, int Position)>()).ToArray();

        // Keep only the products that can enter the first twelve, even when a family is sold out.
        var position = 0;
        await foreach (var product in candidates.AsAsyncEnumerable().WithCancellation(ct))
        {
            var family = heads[product.Family];
            if (family.Count < slots) family.Enqueue((product.Id, position));
            position++;
            if (heads.All(group => group.Count == slots)) break;
        }
        // Introduce each in-stock family, then follow demand while alternating families when possible.
        var leaders = new List<Guid>(slots);
        Queue<(Guid Id, int Position)>? previous = null;
        foreach (var group in heads.Where(group => group.Count > 0).Take(slots))
        {
            leaders.Add(group.Dequeue().Id);
            previous = group;
        }
        while (leaders.Count < slots)
        {
            var next = heads.Where(group => group.Count > 0).OrderBy(group => group == previous)
                .ThenBy(group => group.Peek().Position).FirstOrDefault();
            if (next is null) break;
            leaders.Add(next.Dequeue().Id);
            previous = next;
        }
        return leaders.ToArray();
    }

    private async Task<ProductSignal[]> DemandAsync(PoliValkoDbContext db, DateOnly today, DateOnly season, CancellationToken ct)
    {
        var key = ("storefront-seasonal-demand", today, season);
        if (cache.TryGetValue<ProductSignal[]>(key, out var saved) && saved is not null) return saved;
        await _refresh.WaitAsync(ct);
        try
        {
            if (cache.TryGetValue<ProductSignal[]>(key, out saved) && saved is not null) return saved;
            var lastYear = season.AddYears(-1);
            var twoYearsAgo = season.AddYears(-2);
            var recent = today.AddDays(-27);
            // Count distinct purchase occasions, so a bulk purchase or repeated receipt line cannot dominate.
            var week = today.AddDays(-6);
            var signals = await db.Database.SqlQuery<ProductSignal>($"""
                WITH receipts AS (
                    SELECT d.id, d.day, line->'product'->>'code' AS code,
                        trim(trailing '.' from lower(trim(coalesce(line->'product'->'unit'->>'title',line->'product'->>'unit')))) AS unit,
                        sum((line->>'quantity')::numeric) AS qty
                    FROM accounting.documents d
                    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
                        THEN d.details->'products' ELSE '[]'::jsonb END) line
                    WHERE d.entity_type='receipt' AND d.kind='cash' AND d.status='active'
                        AND d.source_account='valko-dntrade' AND d.total>0 AND d.day <= {today}
                        AND (d.day BETWEEN {recent} AND {today}
                            OR d.day BETWEEN {lastYear.AddDays(-21)} AND {lastYear.AddDays(21)}
                            OR d.day BETWEEN {twoYearsAgo.AddDays(-21)} AND {twoYearsAgo.AddDays(21)})
                        AND CASE WHEN line->>'quantity' ~ '^[0-9]+([.][0-9]+)?$'
                            THEN (line->>'quantity')::numeric > 0 ELSE false END
                    GROUP BY 1,2,3,4
                ), base_units AS (
                    SELECT code, min(trim(trailing '.' from lower(trim(unit)))) AS unit
                    FROM accounting.inventory_lines l JOIN accounting.inventory_reports r ON r.id=l.report_id
                    WHERE r.source_account='valko-dntrade' AND nullif(trim(unit),'') IS NOT NULL
                    GROUP BY code HAVING count(DISTINCT lower(trim(unit)))=1
                ), signals AS (
                    SELECT p.id, CASE WHEN r.day >= {recent} THEN 1
                        WHEN r.day >= {lastYear.AddDays(-21)} THEN 3 ELSE 2 END AS weight, r.id AS purchase_id,
                        r.day, sum(r.qty) AS qty, bool_and(coalesce(u.unit = CASE r.unit
                            WHEN '2009' THEN 'шт' WHEN '0301' THEN 'кг' WHEN '301' THEN 'кг'
                            WHEN '0138' THEN 'л' WHEN '138' THEN 'л' ELSE r.unit END,false)) AS comparable
                    FROM receipts r JOIN catalog.products p ON p.navkolo_id='dntrade-code:'||r.code
                    LEFT JOIN base_units u ON u.code=r.code GROUP BY p.id,r.id,r.day
                    UNION ALL
                    SELECT i.product_id, 1 AS weight, o.id, (o.created_at AT TIME ZONE 'Europe/Kyiv')::date,
                        sum(i.quantity),true
                    FROM ordering.orders o JOIN ordering.order_items i ON i.order_id=o.id
                    WHERE o.created_at >= {KyivTime.StartOfDay(recent)} AND o.created_at < {KyivTime.StartOfDay(today.AddDays(1))}
                        AND o.status IN ('Confirmed','Paid','Shipped','ReadyForPickup','Completed')
                    GROUP BY i.product_id,o.id,o.created_at
                )
                SELECT id AS product_id, sum(weight)::bigint AS demand, count(*) FILTER (WHERE day >= {week})::int AS week,
                    count(*) FILTER (WHERE day >= {recent} AND day < {week})::int AS previous,
                    CASE WHEN bool_and(comparable OR day < {recent})
                        THEN coalesce(sum(qty) FILTER (WHERE day >= {recent}),0) END AS units
                FROM signals GROUP BY id
                """).ToArrayAsync(ct);
            return cache.Set(key, signals, TimeSpan.FromMinutes(10));
        }
        finally { _refresh.Release(); }
    }

    public void Dispose() => _refresh.Dispose();
}
