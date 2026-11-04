namespace PoliValko.Catalog.Features.Console.Products;

public static class ProductStockFilters
{
    public const string In = "in";
    public const string Low = "low";
    public const string Out = "out";

    public const decimal LowStockThreshold = 3;

    public static readonly IReadOnlyList<string> All = [In, Low, Out];
}
