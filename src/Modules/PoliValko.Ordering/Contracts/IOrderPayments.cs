namespace PoliValko.Ordering.Contracts;

public interface IOrderPayments
{
    Task<PayableOrder?> FindPayableAsync(string number, string? token, CancellationToken ct);

    Task<PayableOrder?> FindPayableForCustomerAsync(string number, Guid customerId, CancellationToken ct);

    /// <summary>
    /// Locks the order row until the caller's transaction ends and returns its current state, so two payment starts
    /// for one order run one after another and a cancellation waits for the invoice being opened.
    /// </summary>
    Task<PayableOrder> LockPayableAsync(Guid orderId, CancellationToken ct);

    Task MarkPaymentRetryAsync(Guid orderId, CancellationToken ct);

    Task<OrderPaymentTarget> LoadForPaymentUpdateAsync(Guid orderId, CancellationToken ct);

    Task<PaidOrderResult> MarkPaidAsync(Guid orderId, DateTimeOffset at, CancellationToken ct);

    Task MarkPaymentFailedAsync(Guid orderId, CancellationToken ct);

    Task<RefundToProcess> LoadRefundAsync(Guid orderId, Guid refundId, CancellationToken ct);

    /// <summary>Durably records the provider reference before the refund is sent. False when another run has already claimed it.</summary>
    Task<bool> MarkRefundSubmittedAsync(Guid orderId, Guid refundId, string reference, CancellationToken ct);

    /// <summary>Pending card refunds already sent to the provider and created before <paramref name="createdBefore"/>.</summary>
    Task<IReadOnlyList<SubmittedRefund>> ListSubmittedRefundsAsync(DateTimeOffset createdBefore, int take, CancellationToken ct);

    /// <summary>False when the refund is no longer pending, so the caller must not repeat its side effects.</summary>
    Task<bool> CompleteRefundAsync(Guid orderId, Guid refundId, DateTimeOffset at, CancellationToken ct);

    /// <summary>False when the refund is no longer pending.</summary>
    Task<bool> FailRefundAsync(Guid orderId, Guid refundId, string error, DateTimeOffset at, CancellationToken ct);

    /// <summary>Card refunds the site has made or is still making for the order.</summary>
    Task<decimal> SumProviderRefundsAsync(Guid orderId, CancellationToken ct);

    /// <summary>
    /// Records money the provider returned outside the site (merchant cabinet, bank chargeback) as a completed refund
    /// of every item not yet refunded. Null when <paramref name="amount"/> does not cover them: which items a partial
    /// return was for is unknown, so nothing is recorded.
    /// </summary>
    Task<Guid?> RecordOutsideRefundAsync(Guid orderId, decimal amount, string provider, DateTimeOffset at, CancellationToken ct);
}
