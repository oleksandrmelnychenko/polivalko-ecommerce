namespace PoliValko.Ordering.Contracts;

public interface IOrderReceiptSource
{
    Task<bool> IsAccessibleAsync(string number, string? token, CancellationToken ct);

    Task<OrderForReceipt> GetAsync(Guid orderId, CancellationToken ct);
}
