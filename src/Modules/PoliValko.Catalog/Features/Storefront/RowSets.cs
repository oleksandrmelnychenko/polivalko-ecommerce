namespace PoliValko.Catalog.Features.Storefront;

/// <summary>
/// Names of the row sets that the storefront hands to a query as arrays: what the rules, the receipts of past years,
/// the sections and the last four weeks say about products.
/// <para>
/// Each row set carries its name as one more argument, in a condition that is always true. Without it EF Core takes
/// two row sets of one query for the same when their arguments are equal element by element, and empty arrays are
/// equal whatever they hold: the types of the first such row set are then used for the others. In a shop where a
/// rule was in force but nothing had been sold yet, the sections lent their list of booleans to the units of recent
/// purchases, and the database refused the query ("cannot cast type boolean[] to numeric[]").
/// </para>
/// </summary>
internal static class RowSets
{
    public const string Rules = "rules";
    public const string History = "history";
    public const string Sections = "sections";
    public const string Recent = "recent";
}
