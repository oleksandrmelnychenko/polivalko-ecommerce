using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Fiscal.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Fiscal.Features.Receipts;

internal sealed class RefundReceiptStatuses(PoliValkoDbContext db) : IRefundReceiptStatuses
{
    public async Task<IReadOnlyDictionary<Guid, string>> GetAsync(IReadOnlyCollection<Guid> refundIds, CancellationToken ct)
    {
        if (refundIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var receipts = await db.Set<Receipt>()
            .AsNoTracking()
            .Where(r => r.RefundId != null && refundIds.Contains(r.RefundId.Value))
            .Select(r => new { RefundId = r.RefundId!.Value, r.Status, r.CreatedAt })
            .ToListAsync(ct);
        return receipts
            .GroupBy(r => r.RefundId)
            .ToDictionary(g => g.Key, g => JsonNamingPolicy.CamelCase.ConvertName(g.OrderByDescending(r => r.CreatedAt).First().Status.ToString()));
    }
}
