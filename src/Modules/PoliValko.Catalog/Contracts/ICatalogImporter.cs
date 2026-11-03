namespace PoliValko.Catalog.Contracts;

public interface ICatalogImporter
{
    Task<CatalogImportResult> ImportProductsAsync(IReadOnlyList<NavkoloProductRecord> records, CancellationToken ct);

    Task<CatalogImportResult> ApplyPriceStockAsync(IReadOnlyList<PriceStockRecord> records, CancellationToken ct);
}
