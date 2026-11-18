using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Domain;

namespace PoliValko.Payments.Features.Processing;

internal sealed class PaymentActivity(PoliValkoDbContext db) : IPaymentActivity
{
    public async Task<IReadOnlySet<Guid>> BusySinceAsync(IReadOnlyCollection<Guid> orderIds, DateTimeOffset since, CancellationToken ct)
    {
        var ids = orderIds.Distinct().ToList();
        var busy = await db.Set<Payment>().AsNoTracking()
            .Where(p => ids.Contains(p.OrderId)
                        && (p.Status == PaymentAttemptStatus.Created
                            || p.Status == PaymentAttemptStatus.Processing
                            || p.Status == PaymentAttemptStatus.Succeeded
                            || p.UpdatedAt >= since))
            .Select(p => p.OrderId)
            .Distinct()
            .ToListAsync(ct);
        return busy.ToHashSet();
    }
}
