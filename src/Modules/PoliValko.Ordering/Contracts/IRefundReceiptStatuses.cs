namespace PoliValko.Ordering.Contracts;

public interface IRefundReceiptStatuses
{
    Task<IReadOnlyDictionary<Guid, string>> GetAsync(IReadOnlyCollection<Guid> refundIds, CancellationToken ct);
}
