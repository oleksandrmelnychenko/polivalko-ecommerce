using PoliValko.Catalog.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Console.Features.Analytics;

internal sealed record ProductAnalyticsRequest(
    string Source,
    DateOnly From,
    DateOnly To,
    DateOnly PreviousFrom,
    bool CurrentEnd,
    string? Product,
    string? Search,
    int Page,
    ProductSalesData Sales,
    IReadOnlyList<AnalyticsCatalogProduct> Catalog,
    AnalyticsCatalogInventory Inventory);
