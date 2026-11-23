using PoliValko.Catalog.Domain;

namespace PoliValko.Catalog.Features.Storefront;

public enum Season { In = 0, AllYear = 1, Off = 2 }

/// <summary>Whether a product is in its season, from how often it was bought in the same weeks of past years.</summary>
internal static class SeasonVerdict
{
    /// <summary>The window starts on the day asked about and looks this many days ahead, in each past year.</summary>
    public const int WindowDays = 28;
    public const int Years = 3;

    private const decimal InRatio = 1.5m;
    private const decimal OffRatio = 0.5m;
    private const decimal MinInObserved = 4m;
    private const decimal MinOffExpected = 4m;
    private const decimal MinAllYearExpected = 8m;

    /// <param name="observed">Purchases inside the windows.</param>
    /// <param name="expected">Purchases the windows would hold if the product sold evenly.</param>
    /// <returns>Null when the history is too thin or too close to call.</returns>
    public static Season? Judge(decimal observed, decimal expected)
    {
        // Two standard deviations of a count that small: a difference inside it can be chance.
        var noise = 2m * (decimal)Math.Sqrt((double)expected);
        if (observed >= MinInObserved && observed >= InRatio * expected && observed - expected >= noise) return Season.In;
        if (expected >= MinOffExpected && observed <= OffRatio * expected && expected - observed >= noise) return Season.Off;
        if (expected >= MinAllYearExpected && observed > OffRatio * expected && observed < InRatio * expected) return Season.AllYear;
        return null;
    }

    /// <summary>
    /// A rule for this month or the product's own sales now put it in season. A rule for other months decides when
    /// there is no history at all, and it keeps the category from promoting the product: what its neighbours sell
    /// now can leave it neutral or put it out of season, but not in season. Rules name promotion months, not a
    /// product's whole season, so they do not overrule a category that sells evenly or not at all.
    /// </summary>
    /// <param name="own">What the product's own receipts say.</param>
    /// <param name="category">What its category says, from the nearest level that has a verdict.</param>
    public static Season Combine(bool ruleIn, bool ruleOff, Season? own, Season? category)
    {
        if (ruleIn || own == Season.In) return Season.In;
        var history = own ?? category;
        if (!ruleOff) return history ?? Season.AllYear;
        return history switch { null => Season.Off, Season.In => Season.AllYear, _ => history.Value };
    }

    /// <summary>
    /// The verdict a product without enough history of its own takes from its category: the nearest of the category
    /// and its ancestors whose products together have a verdict. Root tells that it came from the top of the tree.
    /// </summary>
    public static IReadOnlyDictionary<Guid, (Season Verdict, bool Root)> ByCategory(IReadOnlyList<Category> categories,
        IReadOnlyDictionary<Guid, (decimal Observed, decimal Expected)> direct)
    {
        var known = categories.ToDictionary(c => c.Id);
        var children = categories.Where(c => c.ParentId is { } parent && known.ContainsKey(parent)).ToLookup(c => c.ParentId!.Value);
        var own = new Dictionary<Guid, Season?>();

        (decimal Observed, decimal Expected) Sum(Category category)
        {
            var total = direct.GetValueOrDefault(category.Id);
            foreach (var child in children[category.Id])
            {
                var part = Sum(child);
                total = (total.Observed + part.Observed, total.Expected + part.Expected);
            }
            own[category.Id] = Judge(total.Observed, total.Expected);
            return total;
        }

        foreach (var top in categories.Where(c => c.ParentId is not { } parent || !known.ContainsKey(parent))) Sum(top);

        var result = new Dictionary<Guid, (Season, bool)>();
        foreach (var category in categories)
        {
            var current = category;
            // A branch is never deeper than the tree is large: categories that name each other as parents
            // have no top to take a verdict from, and must not keep the catalog waiting.
            for (var step = 0; current is not null && step < categories.Count; step++)
            {
                if (own.GetValueOrDefault(current.Id) is { } verdict)
                {
                    result[category.Id] = (verdict, current.ParentId is not { } above || !known.ContainsKey(above));
                    break;
                }
                current = current.ParentId is { } parent ? known.GetValueOrDefault(parent) : null;
            }
        }
        return result;
    }
}
