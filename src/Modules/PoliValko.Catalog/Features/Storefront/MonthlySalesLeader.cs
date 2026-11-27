using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

internal static class MonthlySalesLeader
{
    private static readonly SemaphoreSlim Refresh = new(1, 1);

    private sealed record MonthlySales(Guid ProductId, int Month, long Score);
    private sealed record Plan(Guid? Last, int Repeats, long Score, Guid? Requested);

    internal static async Task<Guid?> PickAsync(IQueryable<Product> products, SeasonalPurpose.RuleMatches matches,
        PoliValkoDbContext db, IMemoryCache cache, DateOnly today, int requestedMonth, CancellationToken ct)
    {
        var cutoff = new DateOnly(today.Year, today.Month, 1);
        // Receipts before the first of this month: only a late import changes them.
        var sales = await CachedLoad.GetAsync(
            cache,
            ("storefront-monthly-sales", cutoff),
            Refresh,
            TimeSpan.FromHours(6),
            async () => (await ReadSalesAsync(db, cutoff, ct), true),
            ct);
        if (sales.Length == 0) return null;
        var eligible = from p in products
                       join m in SeasonalPurpose.Calendar(db, matches) on p.Id equals m.ProductId
                       where p.Stock.Quantity - p.Stock.ReservedQuantity >= 1 && p.Price.Amount > 0
                       select new { p.Id, m.MonthMask };
        var masks = await eligible.ToDictionaryAsync(p => p.Id, p => p.MonthMask, ct);
        var byMonth = sales.Where(s => (masks.GetValueOrDefault(s.ProductId) & (1 << (s.Month - 1))) != 0)
            .ToLookup(s => s.Month);
        var summer = new List<Guid?>(3);
        for (var month = 5; month <= 7; month++)
        {
            var shortlist = byMonth[month].Take(3).Select(s => (Guid?)s.ProductId).ToArray();
            var fallback = shortlist.FirstOrDefault(id => id != summer.LastOrDefault(), shortlist.FirstOrDefault());
            summer.Add(shortlist.FirstOrDefault(id => !summer.Contains(id), fallback));
        }
        if (requestedMonth is >= 5 and <= 7) return summer[requestedMonth - 5];

        // With both neighbours fixed, at most two SKUs can be excluded. For each possible
        // last SKU retain the best path: first minimise adjacent repeats, then maximise sales.
        List<Plan> paths = [new(summer[2], 0, 0, null)];
        foreach (var month in new[] { 8, 9, 10, 11, 12, 1, 2, 3, 4 })
        {
            var next = new List<Plan>(3);
            foreach (var candidate in byMonth[month].Take(3).DefaultIfEmpty())
            {
                var id = candidate?.ProductId;
                var closingRepeat = id.HasValue && month == 4 && id == summer[0] ? 1 : 0;
                var best = paths.Select(path => new Plan(id,
                        path.Repeats + (id.HasValue && id == path.Last ? 1 : 0) + closingRepeat,
                        path.Score + (candidate?.Score ?? 0), month == requestedMonth ? id : path.Requested))
                    .OrderBy(path => path.Repeats).ThenByDescending(path => path.Score).First();
                next.Add(best);
            }
            paths = next;
        }
        return paths.OrderBy(path => path.Repeats).ThenByDescending(path => path.Score).First().Requested;
    }

    private static Task<MonthlySales[]> ReadSalesAsync(PoliValkoDbContext db, DateOnly cutoff, CancellationToken ct)
    {
        var recent = cutoff.AddYears(-1);
        return db.Database.SqlQuery<MonthlySales>($"""
            WITH monthly AS (
                SELECT line->'product'->>'code' AS code, extract(month FROM d.day)::int AS month,
                    count(DISTINCT d.id) FILTER (WHERE d.day >= {recent}) * 3
                    + count(DISTINCT d.id) FILTER (WHERE d.day < {recent}) * 2 AS score
                FROM accounting.documents d
                CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
                    THEN d.details->'products' ELSE '[]'::jsonb END) line
                WHERE d.source_account='valko-dntrade' AND d.entity_type='receipt' AND d.kind='cash'
                    AND d.status='active' AND d.total>0 AND d.day >= {cutoff.AddYears(-2)} AND d.day < {cutoff}
                    AND CASE WHEN line->>'quantity' ~ '^[0-9]+([.][0-9]+)?$'
                        THEN (line->>'quantity')::numeric > 0 ELSE false END
                GROUP BY 1,2
            )
            SELECT p.id AS product_id, m.month, m.score FROM monthly m
            JOIN catalog.products p ON p.navkolo_id='dntrade-code:'||m.code
            ORDER BY m.month, m.score DESC, p.id
            """).ToArrayAsync(ct);
    }
}
