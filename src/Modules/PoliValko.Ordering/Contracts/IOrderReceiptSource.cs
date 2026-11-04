namespace PoliValko.Ordering.Contracts;

public interface IOrderReceiptSource
{
    Task<bool> IsAccessibleAsync(string number, string? token, CancellationToken ct);

    Task<bool> BelongsToCustomerAsync(string number, Guid customerId, CancellationToken ct);

    Task<OrderForReceipt> GetAsync(Guid orderId, CancellationToken ct);
}
