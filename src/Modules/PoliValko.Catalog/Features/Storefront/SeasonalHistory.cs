using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

/// <summary>What three years of receipts say about each product, and the sums its category can fall back on.</summary>
internal sealed record SeasonHistory(Guid[] ProductIds, int[] Verdicts,
    IReadOnlyDictionary<Guid, (decimal Observed, decimal Expected)> ByCategory)
{
    public const int Undecided = -1;
}

internal static class SeasonalHistory
{
    private sealed record Sold(Guid ProductId, Guid CategoryId, int W1, int W2, int W3, int Total, DateOnly FirstDay);

    /// <param name="today">The last day that can have receipts.</param>
    /// <param name="anchor">The day asked about: today on the storefront, the 15th of a month in a preview.</param>
    public static async Task<SeasonHistory> LoadAsync(PoliValkoDbContext db, IMemoryCache cache, DateOnly today, DateOnly anchor,
        CancellationToken ct) =>
        (await cache.GetOrCreateAsync(("storefront-season-history", today, anchor), entry =>
        {
            // Receipts arrive with an import, a few times a day at most.
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(30);
            return ReadAsync(db, today, anchor, ct);
        }))!;

    private static async Task<SeasonHistory> ReadAsync(PoliValkoDbContext db, DateOnly today, DateOnly anchor, CancellationToken ct)
    {
        var first = anchor.AddYears(-SeasonVerdict.Years);
        // A month looked at ahead has last year's window partly in the future: days that have not come hold no receipts.
        var last = anchor.AddDays(-1) < today ? anchor.AddDays(-1) : today;
        var windows = Enumerable.Range(1, SeasonVerdict.Years).Select(year => anchor.AddYears(-year))
            .Select(start => (Start: start, End: start.AddDays(SeasonVerdict.WindowDays - 1))).ToArray();
        // One receipt is one purchase, however many lines or units of the product it holds. Receipts are counted
        // by product code before the catalog is joined: reading the receipt bodies is then nearly the whole cost
        // (0.5 s for 60 000 receipts; joining the catalog to every line first took 1.4 s).
        var sold = await db.Database.SqlQuery<Sold>($"""
            WITH sold AS (
                SELECT line->'product'->>'code' AS code,
                    count(DISTINCT d.id) FILTER (WHERE d.day BETWEEN {windows[0].Start} AND {windows[0].End})::int AS w1,
                    count(DISTINCT d.id) FILTER (WHERE d.day BETWEEN {windows[1].Start} AND {windows[1].End})::int AS w2,
                    count(DISTINCT d.id) FILTER (WHERE d.day BETWEEN {windows[2].Start} AND {windows[2].End})::int AS w3,
                    count(DISTINCT d.id)::int AS total, min(d.day) AS first_day
                FROM accounting.documents d
                CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(d.details->'products')='array'
                    THEN d.details->'products' ELSE '[]'::jsonb END) line
                WHERE d.entity_type='receipt' AND d.kind='cash' AND d.status='active'
                    AND d.source_account='valko-dntrade' AND d.total>0 AND d.day BETWEEN {first} AND {last}
                    AND CASE WHEN line->>'quantity' ~ '^[0-9]+([.][0-9]+)?$'
                        THEN (line->>'quantity')::numeric > 0 ELSE false END
                GROUP BY 1
            )
            SELECT p.id AS product_id, p.category_id, s.w1, s.w2, s.w3, s.total, s.first_day
            FROM sold s JOIN catalog.products p ON p.navkolo_id='dntrade-code:'||s.code
            """).ToArrayAsync(ct);

        var verdicts = new int[sold.Length];
        var byCategory = new Dictionary<Guid, (decimal Observed, decimal Expected)>();
        for (var i = 0; i < sold.Length; i++)
        {
            var row = sold[i];
            decimal observed = row.W1 + row.W2 + row.W3;
            // An even spread over the product's own life: windows before its first sale say nothing about its season.
            var life = last.DayNumber - row.FirstDay.DayNumber + 1;
            var open = windows.Sum(window =>
            {
                var from = window.Start > row.FirstDay ? window.Start : row.FirstDay;
                var to = window.End < last ? window.End : last;
                return to < from ? 0 : to.DayNumber - from.DayNumber + 1;
            });
            var expected = (decimal)row.Total * open / life;
            verdicts[i] = SeasonVerdict.Judge(observed, expected) is { } verdict ? (int)verdict : SeasonHistory.Undecided;
            var sum = byCategory.GetValueOrDefault(row.CategoryId);
            byCategory[row.CategoryId] = (sum.Observed + observed, sum.Expected + expected);
        }
        return new SeasonHistory(sold.Select(row => row.ProductId).ToArray(), verdicts, byCategory);
    }
}
