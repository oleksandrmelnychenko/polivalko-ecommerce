namespace PoliValko.Catalog.Contracts;

public sealed record ConnectWarehouse(Guid OrgId, Guid StoreId, Guid? ExpectedOrgId, Guid? ExpectedStoreId,
    decimal WarehouseQuantity, decimal ShopQuantity, decimal Reserved);

public sealed record WarehouseConnection(Guid? ProductId, string? Conflict);

public sealed record BulkWarehouseConnection(int Connected, int Skipped, IReadOnlyList<string> Conflicts);

public sealed record DefaultWarehouseSetting(Guid OrgId, Guid StoreId, string Organization, string Store);

public sealed record CatalogWarehouseInitResult(int Initialized, int Connected, int Skipped, IReadOnlyList<string> Conflicts);

public interface ICatalogWarehouseSource
{
    Task<WarehouseConnection> ConnectAsync(Guid id, ConnectWarehouse request, CancellationToken ct);
    Task<BulkWarehouseConnection> ConnectBulkAsync(Guid orgId, Guid storeId, bool overwriteExisting, CancellationToken ct);
    Task<WarehouseConnection> DisconnectAsync(Guid productId, CancellationToken ct);
    Task<DefaultWarehouseSetting?> GetDefaultWarehouseAsync(CancellationToken ct);
    Task<WarehouseConnection> SetDefaultWarehouseAsync(Guid? orgId, Guid? storeId, string updatedBy, CancellationToken ct);
    Task<CatalogWarehouseInitResult> InitializeFromCatalogAsync(
        Guid orgId,
        Guid storeId,
        DateOnly day,
        string reference,
        bool includeZeroStock,
        bool setAsDefault,
        string updatedBy,
        CancellationToken ct);
}
