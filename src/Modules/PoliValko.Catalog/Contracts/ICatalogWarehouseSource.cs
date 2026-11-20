namespace PoliValko.Catalog.Contracts;

public sealed record ConnectWarehouse(Guid OrgId, Guid StoreId, Guid? ExpectedOrgId, Guid? ExpectedStoreId,
    decimal WarehouseQuantity, decimal ShopQuantity, decimal Reserved);

public sealed record WarehouseConnection(Guid? ProductId, string? Conflict);

public interface ICatalogWarehouseSource
{
    Task<WarehouseConnection> ConnectAsync(Guid id, ConnectWarehouse request, CancellationToken ct);
}
