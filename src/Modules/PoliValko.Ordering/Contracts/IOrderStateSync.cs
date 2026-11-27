using PoliValko.Infrastructure.Sync;

namespace PoliValko.Ordering.Contracts;

public sealed record ExternalOrderState(Guid OrderId, bool Shipped, bool Cancelled);

public sealed record OrderStateSyncResult(int Changed, IReadOnlyList<SyncError> Errors);

public interface IOrderStateSync
{
    Task<IReadOnlyList<Guid>> TrackedIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);
    Task LockAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);
    // Caller holds order gates/rows and has imported a fresh stock snapshot in the same transaction.
    Task<OrderStateSyncResult> ApplyAsync(IReadOnlyList<ExternalOrderState> states, IReadOnlySet<string> stockIds, CancellationToken ct);
}
