using PoliValko.Infrastructure.Outbox;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Payments.Features.Refunds;

internal sealed class ProcessRefundRequested(RefundSettlement settlement) : IOutboxHandler<RefundRequested>
{
    public Task HandleAsync(RefundRequested message, CancellationToken cancellationToken) =>
        settlement.SubmitAsync(message.OrderId, message.RefundId, cancellationToken);
}
