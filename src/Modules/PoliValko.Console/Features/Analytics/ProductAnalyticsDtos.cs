namespace PoliValko.Console.Features.Analytics;

public sealed record ProductAnalyticsDto(
    string Source,
    DateOnly From,
    DateOnly To,
    DateOnly PreviousFrom,
    DateOnly PreviousTo,
    ProductAnalyticsCoverageDto Coverage,
    ProductAnalyticsInventoryDto Inventory,
    ProductAnalyticsMetricsDto Metrics,
    IReadOnlyList<ProductAnalyticsTrendDto> Trend,
    IReadOnlyList<ProductAnalyticsSeasonDto>? Seasonality,
    ProductAnalyticsForecastDto? Forecast,
    ProductAnalyticsPageDto Products,
    ProductAnalyticsRowDto? SelectedProduct,
    IReadOnlyList<ProductAnalyticsInsightDto> Insights);

public sealed record ProductAnalyticsCoverageDto(
    DateOnly? FirstSourceDay,
    DateOnly? LastSourceDay,
    int IgnoredDocuments,
    int UnmatchedLines,
    bool ReturnsAvailable);

public sealed record ProductAnalyticsInventoryDto(int HealthyProducts, int LowStockProducts, int OutOfStockProducts, decimal LowStockThreshold);

public sealed record ProductAnalyticsMetricsDto(
    decimal SoldUnits,
    decimal ReturnedUnits,
    decimal GrossRevenue,
    decimal ReturnValue,
    decimal NetRevenue,
    int ActiveProducts,
    decimal? PreviousSoldUnits,
    decimal? PreviousNetRevenue);

public sealed record ProductAnalyticsTrendDto(DateOnly From, DateOnly To, decimal SoldUnits, decimal ReturnedUnits, decimal NetRevenue);

public sealed record ProductAnalyticsSeasonDto(int Month, decimal Index);

public sealed record ProductAnalyticsForecastDto(string Method, decimal ValidationWape, IReadOnlyList<ProductAnalyticsForecastPointDto> Points);

public sealed record ProductAnalyticsForecastPointDto(DateOnly From, DateOnly To, decimal SoldUnits, decimal Low, decimal High);

public sealed record ProductAnalyticsPageDto(IReadOnlyList<ProductAnalyticsRowDto> Items, int Page, int PageSize, int Total);

public sealed record ProductAnalyticsRowDto(
    string ProductKey,
    Guid? CatalogProductId,
    string Name,
    string Sku,
    decimal SoldUnits,
    decimal ReturnedUnits,
    decimal NetRevenue,
    decimal? PreviousSoldUnits,
    decimal? Stock,
    decimal? StockDays,
    string? AbcClass,
    DateOnly? LastSaleDay);

public sealed record ProductAnalyticsInsightDto(string Kind, string Title, string Detail, string? ProductKey = null);
