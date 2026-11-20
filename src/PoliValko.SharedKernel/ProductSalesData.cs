namespace PoliValko.SharedKernel;

public sealed record ProductSalesDay(
    DateOnly Day,
    string ProductKey,
    Guid? CatalogProductId,
    string Name,
    string Sku,
    decimal SoldUnits,
    decimal ReturnedUnits,
    decimal GrossRevenue,
    decimal ReturnValue);

public sealed record ProductSalesData(
    IReadOnlyList<ProductSalesDay> Rows,
    DateOnly? FirstSourceDay,
    DateOnly? LastSourceDay,
    int IgnoredDocuments,
    int UnmatchedLines,
    bool ReturnsAvailable);
