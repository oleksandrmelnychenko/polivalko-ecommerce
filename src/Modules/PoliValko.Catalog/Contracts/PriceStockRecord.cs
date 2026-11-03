namespace PoliValko.Catalog.Contracts;

public sealed record PriceStockRecord(string NavkoloId, decimal Price, decimal? OldPrice, decimal Stock);
