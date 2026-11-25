namespace PoliValko.Catalog.Features.Console.Products;

internal static class ProductFillFilters
{
    public const string MissingPhoto = "missing-photo";
    public const string MissingDescription = "missing-description";
    public const string MissingAttributes = "missing-attributes";
    public const string ShortDescription = "short-description";
    public const string MissingBrand = "missing-brand";
    public const string AnyMissing = "any-missing";

    public const int RecentDays = 30;

    /// <summary>What an editor leaves behind when the text is cleared: counts as no description.</summary>
    public static readonly string[] EmptyDescriptions = ["", "<p></p>", "<p><br></p>", "<p><br/></p>", "<p><br /></p>"];

    /// <summary>A description under this many HTML characters is about two sentences: worth expanding.</summary>
    public const int ShortDescriptionLength = 300;

    public static readonly IReadOnlyList<string> All = [MissingPhoto, MissingDescription, ShortDescription, MissingAttributes, MissingBrand, AnyMissing];
}
