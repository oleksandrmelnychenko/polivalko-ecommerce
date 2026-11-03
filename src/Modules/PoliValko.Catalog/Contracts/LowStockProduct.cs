namespace PoliValko.Catalog.Contracts;

public sealed record LowStockProduct(Guid Id, string Name, string Sku, decimal Stock);
