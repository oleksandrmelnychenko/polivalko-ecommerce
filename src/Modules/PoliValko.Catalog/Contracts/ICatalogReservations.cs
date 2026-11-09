namespace PoliValko.Catalog.Contracts;

public interface ICatalogReservations
{
    // All calls participate in the caller's transaction; lock before checking availability.
    Task LockAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct);
    Task ReserveAsync(Guid orderId, IReadOnlyDictionary<Guid, int> quantities, CancellationToken ct);
    Task ReleaseAsync(Guid orderId, CancellationToken ct);
    Task ConsumeAsync(Guid orderId, CancellationToken ct);
    Task ReconcileFulfilledAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken ct);
}
