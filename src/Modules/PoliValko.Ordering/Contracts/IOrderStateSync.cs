namespace PoliValko.Ordering.Contracts;

public sealed record ExternalOrderState(Guid OrderId, bool Shipped, bool Cancelled);

public interface IOrderStateSync
{
    Task<IReadOnlyList<Guid>> TrackedIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);
    Task LockAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct);
    // Caller holds order gates/rows and has imported a fresh stock snapshot in the same transaction.
    Task<int> ApplyAsync(IReadOnlyList<ExternalOrderState> states, IReadOnlySet<string> stockIds, CancellationToken ct);
}
