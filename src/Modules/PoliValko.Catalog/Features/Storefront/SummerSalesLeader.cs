using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

internal static class SummerSalesLeader
{
    private sealed record MonthlySales(Guid ProductId, int Month, long Score);

    internal static async Task<Guid?> PickAsync(IQueryable<Product> products, IReadOnlyList<Category> categories,
        PoliValkoDbContext db, IMemoryCache cache, DateOnly today, DateOnly season,
        IQueryable<SeasonalPurpose.Match> currentMatches, CancellationToken ct)
    {
        var sales = await cache.GetOrCreateAsync(("storefront-summer-sales", today, season.Year), entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10);
            return ReadSalesAsync(db, today, season.Year, ct);
        }) ?? [];
        var available = products.Where(p => p.Stock.Quantity - p.Stock.ReservedQuantity >= 1 && p.Price.Amount > 0);
        var chosen = new List<Guid>(3);
        Guid? leader = null;
        for (var month = 5; month <= season.Month; month++)
        {
            // Reconstruct earlier choices using the same catalog snapshot, independent of preview request order.
            var ranked = sales.Where(s => s.Month == month).Select(s => s.ProductId).ToArray();
            leader = null;
            if (ranked.Length == 0) continue;
            var matches = month == season.Month ? currentMatches :
                SeasonalPurpose.Query(db, categories, new DateOnly(season.Year, month, 15), true).Rows;
            var eligible = from p in available
                           join m in matches on p.Id equals m.ProductId
                           where ranked.Contains(p.Id)
                           orderby Array.IndexOf(ranked, p.Id)
                           select p.Id;
            // At most two prior choices can precede the highest-selling unused item.
            var shortlist = await eligible.Take(3).ToArrayAsync(ct);
            if (shortlist.Length == 0) continue;
            var fallback = shortlist.FirstOrDefault(id => id != chosen.LastOrDefault(), shortlist[0]);
            leader = shortlist.FirstOrDefault(id => !chosen.Contains(id), fallback);
            chosen.Add(leader.Value);
        }
        return leader;
    }

    private static Task<MonthlySales[]> ReadSalesAsync(PoliValkoDbContext db, DateOnly today, int year, CancellationToken ct)
    {
        var lastMay = new DateOnly(year - 1, 5, 1);
        var earlierMay = lastMay.AddYears(-1);
        return db.Database.SqlQuery<MonthlySales>($"""
            WITH monthly AS (
                SELECT line->'product'->>'code' AS code, extract(month FROM d.day)::int AS month,
                    count(DISTINCT d.id) FILTER (WHERE d.day >= {lastMay}) * 3
                    + count(DISTINCT d.id) FILTER (WHERE d.day < {lastMay}) * 2 AS score
                FROM accounting.documents d
                CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
                    THEN d.details->'products' ELSE '[]'::jsonb END) line
                WHERE d.source_account='valko-dntrade' AND d.entity_type='receipt' AND d.kind='cash'
                    AND d.status='active' AND d.total>0 AND d.day <= {today}
                    AND ((d.day >= {lastMay} AND d.day < {lastMay.AddMonths(3)})
                      OR (d.day >= {earlierMay} AND d.day < {earlierMay.AddMonths(3)}))
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
