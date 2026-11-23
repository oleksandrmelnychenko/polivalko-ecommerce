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
    /// <summary>A rule names the product, but for other months.</summary>
    public bool RuleOff { get; init; }
    /// <summary>The verdict of the product's own receipts, if they are enough for one.</summary>
    public int? Product { get; init; }
    /// <summary>The verdict the product's category gives it, from the nearest level that has one.</summary>
    public int? Category { get; init; }
    public bool? Root { get; init; }
}

/// <summary>Gives every product its season: rules first, its own sales history next, its category's history last.</summary>
internal static class SeasonClassifier
{
    private sealed record Own(Guid ProductId, int Verdict);
    private sealed record Shelf(Guid CategoryId, int Verdict, bool Root);

    /// <param name="today">The last day that can have receipts.</param>
    /// <param name="anchor">The day the season is asked about.</param>
    /// <param name="only">The few products asked about, when it is not the whole catalog.</param>
    public static async Task<IQueryable<SeasonRow>> QueryAsync(IQueryable<Product> products, IReadOnlyList<Category> categories,
        PoliValkoDbContext db, IMemoryCache cache, DateOnly today, DateOnly anchor, CancellationToken ct, Guid[]? only = null)
    {
        var history = await SeasonalHistory.LoadAsync(db, cache, today, anchor, ct);
        // The tree is read now, not when the history was cached: sections are renamed and moved while the shop runs.
        var shelves = SeasonVerdict.ByCategory(categories, history.ByCategory).ToArray();
        var shelfIds = shelves.Select(shelf => shelf.Key).ToArray();
        var shelfVerdicts = shelves.Select(shelf => (int)shelf.Value.Verdict).ToArray();
        var shelfRoots = shelves.Select(shelf => shelf.Value.Root).ToArray();
        var own = db.Database.SqlQuery<Own>($"""
            SELECT id AS product_id, verdict FROM unnest({history.ProductIds}::uuid[], {history.Verdicts}::int[]) AS h(id, verdict)
            WHERE verdict >= 0
            """);
        var byCategory = db.Database.SqlQuery<Shelf>($"""
            SELECT id AS category_id, verdict, root
            FROM unnest({shelfIds}::uuid[], {shelfVerdicts}::int[], {shelfRoots}::bool[]) AS c(id, verdict, root)
            """);
        var rules = SeasonalPurpose.Matches(db, categories, anchor).Rows;
        if (only is not null)
        {
            // Matching every rule against the whole catalog is most of the cost: here the rules meet these products alone.
            products = products.Where(p => only.Contains(p.Id));
            rules = rules.Where(match => only.Contains(match.ProductId));
        }
        return from p in products
               join r in rules on p.Id equals r.ProductId into ruled
               from rule in ruled.DefaultIfEmpty()
               join o in own on p.Id equals o.ProductId into sold
               from receipts in sold.DefaultIfEmpty()
               join c in byCategory on p.CategoryId equals c.CategoryId into placed
               from shelf in placed.DefaultIfEmpty()
               let ruleIn = rule.Family != null
               // A rule names the product, but for other months. Without a rule there are no months to compare.
               let ruleOff = rule.MonthMask > 0 && rule.Family == null
               let sales = (int?)receipts.Verdict
               let verdict = sales ?? (int?)shelf.Verdict
               select new SeasonRow
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
                   Product = (int?)receipts.Verdict,
                   Category = (int?)shelf.Verdict,
                   Root = (bool?)shelf.Root,
               };
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
