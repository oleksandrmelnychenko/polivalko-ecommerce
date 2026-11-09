namespace PoliValko.Ordering.Contracts;

public sealed record OrderForExportLine(string Sku, string Name, int Quantity, decimal UnitPrice, string? NavkoloId = null);
