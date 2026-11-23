using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Storefront;

/// <summary>A product's season on one day, with what is needed to say where it came from.</summary>
internal sealed class SeasonRow
{
    public Guid ProductId { get; init; }
    /// <summary>A <see cref="Season"/> as a number, so that it sorts in the database.</summary>
    public int State { get; init; }
    public bool RuleIn { get; init; }
    /// <summary>A rule names the product, but for months that the four weeks ahead do not reach.</summary>
    public bool RuleOff { get; init; }
    /// <summary>The verdict of the product's own receipts, if they are enough for one.</summary>
    public int? Product { get; init; }
    /// <summary>The verdict the product's category gives it, from the nearest level that has one.</summary>
    public int? Category { get; init; }
    public bool? Root { get; init; }
}

/// <summary>A product with its season on one day and what the catalog ranks it by inside that season.</summary>
internal sealed class Seasoned
{
    public required Product Product { get; init; }
    public required SeasonRow Season { get; init; }
    /// <summary>The place of the product's rule family among the first twelve, while one of its rules is in force.</summary>
    public int? Family { get; init; }
    /// <summary>Purchases in the weeks looked at, in past years.</summary>
    public long Demand { get; init; }
}

/// <param name="Families">How many rule families are in force on the day.</param>
/// <param name="Matches">Which rules name each product, for whoever else needs them in the same request.</param>
internal sealed record Seasons(IQueryable<Seasoned> Products, int Families, SeasonalPurpose.RuleMatches Matches);

/// <summary>Gives every product its season: rules first, its own sales history next, its category's history last.</summary>
internal static class SeasonClassifier
{
    private sealed record Own(Guid ProductId, int? Verdict, long Demand);
    private sealed record Shelf(Guid CategoryId, int Verdict, bool Root);

    /// <summary>The seasons alone, to show them.</summary>
    public static async Task<IQueryable<SeasonRow>> QueryAsync(IQueryable<Product> products, IReadOnlyList<Category> categories,
        PoliValkoDbContext db, IMemoryCache cache, DateOnly today, DateOnly anchor, CancellationToken ct, Guid[]? only = null) =>
        (await ClassifyAsync(products, categories, db, cache, today, anchor, ct, only)).Products.Select(product => product.Season);

    /// <param name="today">The last day that can have receipts.</param>
    /// <param name="anchor">The day the season is asked about.</param>
    /// <param name="only">The few products asked about, when it is not the whole catalog.</param>
    public static async Task<Seasons> ClassifyAsync(IQueryable<Product> products, IReadOnlyList<Category> categories,
        PoliValkoDbContext db, IMemoryCache cache, DateOnly today, DateOnly anchor, CancellationToken ct, Guid[]? only = null)
    {
        var history = await SeasonalHistory.LoadAsync(db, cache, today, anchor, ct);
        // The tree is read now, not when the history was cached: sections are renamed and moved while the shop runs.
        var shelves = SeasonVerdict.ByCategory(categories, history.ByCategory).ToArray();
        var shelfIds = shelves.Select(shelf => shelf.Key).ToArray();
        var shelfVerdicts = shelves.Select(shelf => (int)shelf.Value.Verdict).ToArray();
        var shelfRoots = shelves.Select(shelf => shelf.Value.Root).ToArray();
        var own = db.Database.SqlQuery<Own>($"""
            SELECT id AS product_id, nullif(verdict, {SeasonHistory.Undecided}) AS verdict, demand
            FROM unnest({history.ProductIds}::uuid[], {history.Verdicts}::int[], {history.Demand}::bigint[]) AS h(id, verdict, demand)
            WHERE {RowSets.History} IS NOT NULL
            """);
        var byCategory = db.Database.SqlQuery<Shelf>($"""
            SELECT id AS category_id, verdict, root
            FROM unnest({shelfIds}::uuid[], {shelfVerdicts}::int[], {shelfRoots}::bool[]) AS c(id, verdict, root)
            WHERE {RowSets.Sections} IS NOT NULL
            """);
        var matches = await SeasonalPurpose.LoadAsync(db, cache, categories, ct);
        var (rules, families) = SeasonalPurpose.Matches(db, matches, categories, anchor);
        // The month in which the four weeks looked at end. A rule that starts by then is about to be in force.
        var soon = 1 << (anchor.AddDays(SeasonVerdict.WindowDays - 1).Month - 1);
        if (only is not null)
        {
            // Here the rules meet these products alone.
            products = products.Where(p => only.Contains(p.Id));
            rules = rules.Where(match => only.Contains(match.ProductId));
        }
        var seasoned = from p in products
               join r in rules on p.Id equals r.ProductId into ruled
               from rule in ruled.DefaultIfEmpty()
               join o in own on p.Id equals o.ProductId into sold
               from receipts in sold.DefaultIfEmpty()
               join c in byCategory on p.CategoryId equals c.CategoryId into placed
               from shelf in placed.DefaultIfEmpty()
               let ruleIn = rule.Family != null
               // A rule names the product, but for months the four weeks ahead do not reach: only then does it
               // speak against the season. Without a rule there are no months to compare.
               let ruleOff = rule.MonthMask > 0 && rule.Family == null && (rule.MonthMask & soon) == 0
               let sales = receipts.Verdict
               let verdict = sales ?? (int?)shelf.Verdict
               select new Seasoned
               {
                   Product = p,
                   Season = new SeasonRow
                   {
                       ProductId = p.Id,
                       // The same decision as SeasonVerdict.Combine, made where the catalog is sorted.
                       State = ruleIn || sales == (int)Season.In ? (int)Season.In
                           : !ruleOff ? verdict ?? (int)Season.AllYear
                           : verdict == null ? (int)Season.Off
                           : verdict == (int)Season.In ? (int)Season.AllYear
                           : verdict.Value,
                       RuleIn = ruleIn,
                       RuleOff = ruleOff,
                       Product = receipts.Verdict,
                       Category = (int?)shelf.Verdict,
                       Root = (bool?)shelf.Root,
                   },
                   Family = rule.Family,
                   Demand = (long?)receipts.Demand ?? 0L,
               };
        return new Seasons(seasoned, families, matches);
    }

    public static string Name(int state) => (Season)state switch
    {
        Season.In => "in_season",
        Season.Off => "off_season",
        _ => "all_year",
    };

    /// <summary>
    /// What decided the state: a rule, the product's own receipts, its category's, its department's, a rule for
    /// other months holding back a category that sells now, or nothing.
    /// </summary>
    public static string Source(SeasonRow row) =>
        row.State == (int)Season.In && row.RuleIn ? "rule"
        : row.Product is not null ? "product"
        : row.RuleOff && row.Category == (int)Season.In ? "rule_capped"
        : row.Category is not null ? row.Root == true ? "department" : "category"
        // Off season without any history: only a rule for other months can have said so.
        : row.State == (int)Season.Off ? "rule"
        : "none";
}
