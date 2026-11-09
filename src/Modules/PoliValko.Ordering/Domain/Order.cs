using PoliValko.Ordering.Contracts;

namespace PoliValko.Ordering.Domain;

public sealed class Order
{
    public Guid Id { get; init; }

    public required string Number { get; init; }

    public required string AccessTokenHash { get; init; }

    public required string IdempotencyKey { get; init; }

    public OrderStatus Status { get; set; }

    public PaymentMethod PaymentMethod { get; init; }

    public PaymentStatus PaymentStatus { get; private set; }

    public DeliveryMethod DeliveryMethod { get; init; }

    public required string CustomerName { get; init; }

    public required string CustomerPhone { get; init; }

    public string? CustomerEmail { get; init; }

    public Guid? CustomerId { get; private set; }

    public string? SettlementRef { get; init; }

    public string? SettlementName { get; init; }

    public string? WarehouseRef { get; init; }

    public string? WarehouseName { get; init; }

    public string? DeliveryAddress { get; init; }

    public string? PickupAddress { get; init; }

    public string? Comment { get; init; }

    public string? InternalNote { get; private set; }

    public required string SellerName { get; init; }

    public string? SellerTaxId { get; init; }

    public decimal Subtotal { get; init; }

    public decimal Total { get; init; }

    public decimal RefundedAmount { get; private set; }

    public string? NavkoloOrderRef { get; private set; }

    public DateTimeOffset? NavkoloExportedAt { get; private set; }
    public DateTimeOffset? NavkoloExportAttemptedAt { get; private set; }
    public DateTimeOffset? NavkoloCancellationRequestedAt { get; private set; }
    public DateTimeOffset? NavkoloCancellationSynchronizedAt { get; private set; }
    public DateTimeOffset? NavkoloShippedAt { get; private set; }
    public DateTimeOffset? NavkoloCancelledAt { get; private set; }

    public DateTimeOffset CreatedAt { get; init; }

    public uint Version { get; private set; }

    public List<OrderItem> Items { get; init; } = [];

    public List<OrderStatusChange> History { get; init; } = [];

    public List<OrderRefund> Refunds { get; init; } = [];

    public void LinkCustomer(Guid customerId) => CustomerId ??= customerId;

    public bool ChangeInternalNote(string? note, DateTimeOffset at, string by)
    {
        if (string.Equals(InternalNote, note, StringComparison.Ordinal))
        {
            return false;
        }

        InternalNote = note;
        History.Add(new OrderStatusChange
        {
            Id = Guid.CreateVersion7(at),
            OrderId = Id,
            From = Status,
            To = Status,
            At = at,
            By = by,
            Reason = OrderStatusChange.NoteChanged,
        });
        return true;
    }

    public void InitPaymentStatus() =>
        PaymentStatus = PaymentMethod == PaymentMethod.Card ? PaymentStatus.Pending : PaymentStatus.NotRequired;

    public void ChangeStatus(OrderStatus to, DateTimeOffset at, string by, string? reason = null)
    {
        RecordStatus(to, at, by, reason);
        if (to == OrderStatus.Cancelled) NavkoloCancellationRequestedAt = at;
    }

    private void RecordStatus(OrderStatus to, DateTimeOffset at, string by, string? reason)
    {
        History.Add(new OrderStatusChange
        {
            Id = Guid.CreateVersion7(at),
            OrderId = Id,
            From = Status,
            To = to,
            At = at,
            By = by,
            Reason = reason,
        });
        Status = to;
    }

    public bool ObserveNavkolo(ExternalOrderState state, DateTimeOffset at)
    {
        var shipped = state.Shipped && NavkoloShippedAt is null;
        var cancelled = state.Cancelled && NavkoloCancelledAt is null;
        if (!shipped && !cancelled) return false;
        if (shipped) NavkoloShippedAt = at;
        if (cancelled) NavkoloCancelledAt = at;
        // The provider exposes no revision timestamp. Terminal facts never regress on later polls.
        var target = Status;
        if (NavkoloShippedAt is not null)
        {
            if (Status is not (OrderStatus.Completed or OrderStatus.Cancelled)) target = OrderStatus.Shipped;
        }
        else if (cancelled && Status is not (OrderStatus.Shipped or OrderStatus.Completed)) target = OrderStatus.Cancelled;
        if (target == OrderStatus.Cancelled && state.Cancelled && NavkoloShippedAt is null)
            NavkoloCancellationSynchronizedAt ??= at;
        var reason = shipped ? "Відвантаження підтверджено в Навколо; залишки звірено." : "Скасування підтверджено в Навколо.";
        if ((NavkoloShippedAt is not null && (target == OrderStatus.Cancelled || NavkoloCancelledAt is not null)) ||
            (cancelled && target is OrderStatus.Shipped or OrderStatus.Completed))
            reason += " Конфлікт скасування та відвантаження: перевірте облік і повернення товару.";
        RecordStatus(target, at, "Навколо", reason);
        // A confirmed remote document also resolves a lost upload response; never upload it again.
        MarkExported(Id.ToString(), at);
        return true;
    }

    public bool MarkPaid(DateTimeOffset at, string by)
    {
        if (PaymentStatus is PaymentStatus.Succeeded or PaymentStatus.PartiallyRefunded or PaymentStatus.Refunded)
        {
            return false;
        }

        PaymentStatus = PaymentStatus.Succeeded;
        if (Status == OrderStatus.AwaitingPayment)
        {
            ChangeStatus(OrderStatus.Paid, at, by);
        }

        return true;
    }

    public void MarkPaymentFailed()
    {
        if (PaymentStatus == PaymentStatus.Pending)
        {
            PaymentStatus = PaymentStatus.Failed;
        }
    }

    public void MarkPaymentRetry()
    {
        if (PaymentStatus == PaymentStatus.Failed)
        {
            PaymentStatus = PaymentStatus.Pending;
        }
    }

    public void ApplySucceededRefund(OrderRefund refund, DateTimeOffset at)
    {
        if (refund.Status == RefundStatus.Succeeded)
        {
            return;
        }

        refund.Status = RefundStatus.Succeeded;
        refund.CompletedAt = at;
        refund.Error = null;
        RefundedAmount += refund.Amount;
        if (PaymentMethod == PaymentMethod.Card)
        {
            PaymentStatus = RefundedAmount >= Total ? PaymentStatus.Refunded : PaymentStatus.PartiallyRefunded;
        }
    }

    public void MarkExported(string reference, DateTimeOffset at)
    {
        NavkoloOrderRef ??= reference;
        NavkoloExportedAt ??= at;
    }
}
