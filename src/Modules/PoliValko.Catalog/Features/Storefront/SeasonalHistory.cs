using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

/// <summary>What three years of receipts say about each product, and the sums its category can fall back on.</summary>
/// <param name="Demand">
/// Purchases in the weeks looked at: last year's count three times, the year before twice, the one before that once.
/// </param>
internal sealed record SeasonHistory(Guid[] ProductIds, int[] Verdicts, long[] Demand,
    IReadOnlyDictionary<Guid, (decimal Observed, decimal Expected)> ByCategory)
{
    public const int Undecided = -1;
}

internal static class SeasonalHistory
{
    private static readonly SemaphoreSlim Reading = new(1, 1);
    private sealed record Sold(Guid ProductId, Guid CategoryId, int W1, int W2, int W3, int Total, DateOnly FirstDay);

    /// <param name="today">The last day that can have receipts.</param>
    /// <param name="anchor">The day asked about: today on the storefront, the 15th of a month in a preview.</param>
    public static Task<SeasonHistory> LoadAsync(PoliValkoDbContext db, IMemoryCache cache, DateOnly today, DateOnly anchor,
        CancellationToken ct) =>
        // Every listing of the shop needs this, and reading three years of receipts takes about half a second on the
        // live database. For today the receipts end with yesterday and the key names the day, so the answer changes
        // only when receipts of past days are imported, a few times a day at most: it is kept for hours.
        CachedLoad.GetAsync(cache, ("storefront-season-history", today, anchor), Reading, TimeSpan.FromHours(6),
            async () => (await ReadAsync(db, today, anchor, ct), true), ct);

    private static async Task<SeasonHistory> ReadAsync(PoliValkoDbContext db, DateOnly today, DateOnly anchor, CancellationToken ct)
    {
        // A month looked at ahead has last year's window partly in the future: days that have not come hold no receipts.
        var last = anchor.AddDays(-1) < today ? anchor.AddDays(-1) : today;
        var windows = Enumerable.Range(1, SeasonVerdict.Years).Select(year => anchor.AddYears(-year))
            .Select(start => (Start: start, End: start.AddDays(SeasonVerdict.WindowDays - 1))).ToArray();
        // The receipts start one window before the oldest window: that tells a product already selling
        // when the window began from one first sold inside it.
        var first = windows[^1].Start.AddDays(-SeasonVerdict.WindowDays);
        // Hidden products count too: what a section sold in past years tells its season even if those goods are gone.
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
            int[] bought = [row.W1, row.W2, row.W3];
            decimal observed = 0;
            var open = 0;
            for (var w = 0; w < windows.Length; w++)
            {
                // A window that had begun before the product was first sold holds its launch, not its season:
                // a few purchases right after it appeared would outweigh the rest of a short life.
                if (windows[w].Start <= row.FirstDay) continue;
                var to = windows[w].End < last ? windows[w].End : last;
                if (to < windows[w].Start) continue;
                observed += bought[w];
                open += to.DayNumber - windows[w].Start.DayNumber + 1;
            }
            // An even spread over the product's own life.
            var life = last.DayNumber - row.FirstDay.DayNumber + 1;
            var expected = (decimal)row.Total * open / life;
            verdicts[i] = SeasonVerdict.Judge(observed, expected) is { } verdict ? (int)verdict : SeasonHistory.Undecided;
            var sum = byCategory.GetValueOrDefault(row.CategoryId);
            byCategory[row.CategoryId] = (sum.Observed + observed, sum.Expected + expected);
        }
        // A launch counts as a purchase like any other: this ranks products, it does not judge their season.
        var demand = sold.Select(row => 3L * row.W1 + 2L * row.W2 + row.W3).ToArray();
        return new SeasonHistory(sold.Select(row => row.ProductId).ToArray(), verdicts, demand, byCategory);
    }
}
