namespace PoliValko.Ordering.Contracts;

public interface IPaymentActivity
{
    Task<IReadOnlySet<Guid>> BusySinceAsync(IReadOnlyCollection<Guid> orderIds, DateTimeOffset since, CancellationToken ct);
}
