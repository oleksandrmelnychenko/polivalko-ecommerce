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

    /// <summary>The rule families that open the first twelve places in a month that has no list of its own.</summary>
    internal static string[] LeadingFamilies(DateOnly day) => day.Month switch
    {
        11 or 12 => ["novyi-rik", "Обігрівачі", "Годівниці", PlantCovers],
        1 => ["Обігрівачі", "Годівниці", "Насіння", "Грунти та добавки"],
        2 or 3 => ["Насіння", "Грунти та добавки", "Горщики", PlantCovers, "Гілкорізи/Сучкорізи/Секатори/Ножиці"],
        4 or 5 => ["vse-dlia-roslyn", "vse-dlia-polyvu", "Композитні грядки"],
        6 or 7 or 8 => ["vse-dlia-polyvu", "vse-dlia-vidpochynku", "Хімія для басейнів"],
        _ => ["Гілкорізи/Сучкорізи/Секатори/Ножиці", "Насіння газонних трав", PlantCovers, "Септик/Компост", "Все для прибирання"],
    };

    /// <summary>
    /// The catalog in the order of a storefront mode: pins, what can be bought, the season (in season, all year, out of
    /// season), then what the mode ranks by, photos and names. Nothing is left out.
    /// </summary>
    /// <param name="today">The last day that can have receipts.</param>
    /// <param name="seasonDate">The day the season is asked about, when another month is looked at ahead.</param>
    public async Task<IQueryable<Product>> SortAsync(IQueryable<Product> products, IReadOnlyList<Category> categories,
        string? term, PoliValkoDbContext db, DateOnly today, CancellationToken ct, string mode = ProductSort.Seasonal,
        bool acrossCategories = true, Guid[]? pinned = null, DateOnly? seasonDate = null,
        IReadOnlyList<Guid[]>? relevance = null, Guid[]? about = null)
    {
        var season = seasonDate ?? today;
        var seasons = await SeasonClassifier.ClassifyAsync(products, categories, db, cache, today, season, ct);
        var recent = await RecentAsync(db, today, ct);
        var ids = recent.Select(r => r.ProductId).ToArray();
        var purchases = recent.Select(r => r.Purchases).ToArray();
        var units = recent.Select(r => r.Units).ToArray();
        var lately = db.Database.SqlQuery<RecentRank>($"""
            SELECT id AS product_id, purchases, units
            FROM unnest({ids}::uuid[], {purchases}::bigint[], {units}::numeric[]) AS r(id, purchases, units)
            WHERE {RowSets.Recent} IS NOT NULL
            """);
        var measuredSince = KyivTime.StartOfDay(today.AddDays(-28));
        var scored = from s in seasons.Products
               join r in lately on s.Product.Id equals r.ProductId into bought
               from rank in bought.DefaultIfEmpty()
               let p = s.Product
               let available = p.Stock.Quantity - p.Stock.ReservedQuantity
               let sold = (decimal?)rank.Units
               // Zero sales count as slow movement only for established items with several units available.
               let cover = sold > 0 ? 28m * available / sold :
                   ((rank.ProductId == null || sold == 0) && available >= 3 && p.CreatedAt < measuredSince ? 3650m : 0m)
               select new { p, available, cover, state = s.Season.State, family = s.Family,
                   // The same weeks of past years, then the last four weeks: tills twice, the site once.
                   demand = s.Demand + ((long?)rank.Purchases ?? 0L) };
        var seasonalMode = mode == ProductSort.Seasonal;
        Guid[] leaders = [];
        Guid? monthlyLeader = null;
        if (seasonalMode && acrossCategories && string.IsNullOrWhiteSpace(term))
        {
            monthlyLeader = await MonthlySalesLeader.PickAsync(products, seasons.Matches, db, cache, today, season.Month, ct);
            if (seasons.Families > 0)
            {
                // Products that only their sales put in season take turns with the rule families as one more family.
                var bySales = seasons.Families;
                var candidates = scored.Where(s => s.state == (int)Season.In && s.available >= 1 && s.p.Price.Amount > 0)
                    .OrderByDescending(s => s.demand).ThenByDescending(s => s.p.Images.Any())
                    .ThenBy(s => s.p.DisplayName ?? s.p.Name).ThenBy(s => s.p.Id)
                    .Select(s => new Candidate(s.p.Id, s.family ?? bySales));
                leaders = await LeadingProductsAsync(candidates, seasons.Families + 1, ct);
            }
        }
        var ordered = scored.OrderByDescending(s => term != null && s.p.Sku == term);
        // Search results: how well a product matches the words comes before stock and season.
        foreach (var tier in relevance ?? [])
            ordered = ordered.ThenByDescending(s => tier.Contains(s.p.Id));
        if (pinned is { Length: > 0 })
            ordered = ordered.ThenByDescending(s => pinned.Contains(s.p.Id)).ThenBy(s => Array.IndexOf(pinned, s.p.Id));
        ordered = ordered.ThenByDescending(s => s.available >= 1 && s.p.Price.Amount > 0);
        // Among what can be bought, and then among the rest, a product the visitor can see before one without a photo:
        // pages without a photo are also kept out of search (GetSitemap).
        ordered = ordered.ThenByDescending(s => s.p.Images.Any());
        // Among what can be bought, the thing itself before what goes with it: «Шланг …» before «… для шланга».
        if (about is { Length: > 0 }) ordered = ordered.ThenByDescending(s => about.Contains(s.p.Id));
        if (monthlyLeader is { } leader) ordered = ordered.ThenByDescending(s => s.p.Id == leader);
        if (leaders.Length > 0)
            ordered = ordered.ThenByDescending(s => leaders.Contains(s.p.Id)).ThenBy(s => Array.IndexOf(leaders, s.p.Id));
        ordered = ordered.ThenBy(s => s.state);
        // Stock that would last eight weeks or longer comes first, the largest first.
        if (!seasonalMode) ordered = ordered.ThenByDescending(s => s.cover >= 56).ThenByDescending(s => s.cover);
        return ordered.ThenByDescending(s => s.demand)
            .ThenBy(s => s.p.DisplayName ?? s.p.Name).ThenBy(s => s.p.Id).Select(s => s.p);
    }

    private sealed record Candidate(Guid Id, int Family);
    private sealed record RecentRank(Guid? ProductId, long Purchases, decimal? Units);
    private sealed record Recent(Guid ProductId, long Purchases, decimal? Units);

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

    /// <summary>
    /// What was bought in the last four weeks: a till receipt counts twice, an order on the site once, each once
    /// however many lines or units of the product it holds. Units are given when every purchase is in the stock unit.
    /// </summary>
    private Task<Recent[]> RecentAsync(PoliValkoDbContext db, DateOnly today, CancellationToken ct) =>
        CachedLoad.GetAsync(cache, ("storefront-recent-purchases", today), _refresh, TimeSpan.FromMinutes(10), async () =>
        {
            var since = today.AddDays(-27);
            var bought = await db.Database.SqlQuery<Recent>($"""
                WITH receipts AS (
                    SELECT d.id, line->'product'->>'code' AS code,
                        trim(trailing '.' from lower(trim(coalesce(line->'product'->'unit'->>'title',line->'product'->>'unit')))) AS unit,
                        sum((line->>'quantity')::numeric) AS qty
                    FROM accounting.documents d
                    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
                        THEN d.details->'products' ELSE '[]'::jsonb END) line
                    WHERE d.entity_type='receipt' AND d.kind='cash' AND d.status='active'
                        AND d.source_account='valko-dntrade' AND d.total>0 AND d.day BETWEEN {since} AND {today}
                        AND CASE WHEN line->>'quantity' ~ '^[0-9]+([.][0-9]+)?$'
                            THEN (line->>'quantity')::numeric > 0 ELSE false END
                    GROUP BY 1,2,3
                ), base_units AS (
                    SELECT code, min(trim(trailing '.' from lower(trim(unit)))) AS unit
                    FROM accounting.inventory_lines l JOIN accounting.inventory_reports r ON r.id=l.report_id
                    WHERE r.source_account='valko-dntrade' AND nullif(trim(unit),'') IS NOT NULL
                    GROUP BY code HAVING count(DISTINCT lower(trim(unit)))=1
                ), purchases AS (
                    SELECT p.id, 2 AS weight, sum(r.qty) AS qty, bool_and(coalesce(u.unit = CASE r.unit
                            WHEN '2009' THEN 'шт' WHEN '0301' THEN 'кг' WHEN '301' THEN 'кг'
                            WHEN '0138' THEN 'л' WHEN '138' THEN 'л' ELSE r.unit END,false)) AS comparable
                    FROM receipts r JOIN catalog.products p ON p.navkolo_id='dntrade-code:'||r.code
                    LEFT JOIN base_units u ON u.code=r.code GROUP BY p.id,r.id
                    UNION ALL
                    SELECT i.product_id, 1, sum(i.quantity), true
                    FROM ordering.orders o JOIN ordering.order_items i ON i.order_id=o.id
                    WHERE o.created_at >= {KyivTime.StartOfDay(since)} AND o.created_at < {KyivTime.StartOfDay(today.AddDays(1))}
                        AND o.status IN ('Confirmed','Paid','Shipped','ReadyForPickup','Completed')
                    GROUP BY i.product_id,o.id
                )
                SELECT id AS product_id, sum(weight)::bigint AS purchases,
                    CASE WHEN bool_and(comparable) THEN coalesce(sum(qty),0) END AS units
                FROM purchases GROUP BY id
                """).ToArrayAsync(ct);
            return (bought, true);
        }, ct);

    public void Dispose() => _refresh.Dispose();
}
