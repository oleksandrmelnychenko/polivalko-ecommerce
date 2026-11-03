namespace PoliValko.Ordering.Contracts;

public interface IOrderExportSource
{
    Task<OrderForExport> GetAsync(Guid orderId, CancellationToken ct);

    Task MarkExportedAsync(Guid orderId, string reference, DateTimeOffset at, CancellationToken ct);
}
