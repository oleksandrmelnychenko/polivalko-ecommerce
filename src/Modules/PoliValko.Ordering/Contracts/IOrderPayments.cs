namespace PoliValko.Ordering.Contracts;

public interface IOrderPayments
{
    Task<PayableOrder?> FindPayableAsync(string number, string? token, CancellationToken ct);

    Task<PayableOrder?> FindPayableForCustomerAsync(string number, Guid customerId, CancellationToken ct);

    Task MarkPaymentRetryAsync(Guid orderId, CancellationToken ct);

    Task<OrderPaymentTarget> LoadForPaymentUpdateAsync(Guid orderId, CancellationToken ct);

    Task<PaidOrderResult> MarkPaidAsync(Guid orderId, DateTimeOffset at, CancellationToken ct);

    Task MarkPaymentFailedAsync(Guid orderId, CancellationToken ct);

    Task<RefundToProcess> LoadRefundAsync(Guid orderId, Guid refundId, CancellationToken ct);

    Task CompleteRefundAsync(Guid orderId, Guid refundId, string? providerRef, DateTimeOffset at, CancellationToken ct);

    Task FailRefundAsync(Guid orderId, Guid refundId, string error, DateTimeOffset at, CancellationToken ct);
}
