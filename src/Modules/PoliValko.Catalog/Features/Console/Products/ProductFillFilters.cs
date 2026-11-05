namespace PoliValko.Catalog.Features.Console.Products;

internal static class ProductFillFilters
{
    public const string MissingPhoto = "missing-photo";
    public const string MissingDescription = "missing-description";
    public const string MissingAttributes = "missing-attributes";
    public const string AnyMissing = "any-missing";

    public const int RecentDays = 30;

    public static readonly IReadOnlyList<string> All = [MissingPhoto, MissingDescription, MissingAttributes, AnyMissing];
}
