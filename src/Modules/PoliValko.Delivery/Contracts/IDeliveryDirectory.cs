namespace PoliValko.Delivery.Contracts;

public interface IDeliveryDirectory
{
    ValueTask<IReadOnlyList<Settlement>> SearchSettlementsAsync(string? query, int limit, CancellationToken ct);

    ValueTask<Settlement?> FindSettlementAsync(string reference, CancellationToken ct);

    ValueTask<IReadOnlyList<Warehouse>?> GetWarehousesAsync(string settlementRef, string? query, CancellationToken ct);

    ValueTask<Warehouse?> FindWarehouseAsync(string reference, CancellationToken ct);
}
