using PoliValko.Infrastructure.Outbox;

namespace PoliValko.Ordering.Contracts;

public sealed record FiscalReceiptRequested(Guid OrderId, FiscalTrigger Trigger, Guid? RefundId = null) : IOutboxMessage
{
    public static string Type => "ordering.fiscal-receipt-requested";
}
