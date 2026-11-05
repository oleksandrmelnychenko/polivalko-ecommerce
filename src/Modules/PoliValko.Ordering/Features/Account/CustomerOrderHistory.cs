using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Account;

internal sealed class CustomerOrderHistory(PoliValkoDbContext db) : ICustomerOrderHistory
{
    public async Task<IReadOnlyDictionary<Guid, int>> CountOrdersAsync(IReadOnlyCollection<Guid> customerIds, CancellationToken ct)
    {
        if (customerIds.Count == 0)
        {
            return new Dictionary<Guid, int>();
        }

        return await db.Set<Order>()
            .Where(o => o.CustomerId != null && customerIds.Contains(o.CustomerId.Value))
            .GroupBy(o => o.CustomerId!.Value)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
    }

    public async Task<IReadOnlyList<CustomerOrderRecord>> ListOrdersAsync(Guid customerId, int take, CancellationToken ct)
    {
        var rows = await db.Set<Order>()
            .AsNoTracking()
            .Where(o => o.CustomerId == customerId)
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)
            .Take(take)
            .Select(o => new { o.Number, o.CreatedAt, o.Status, o.Total })
            .ToListAsync(ct);
        return rows.Select(o => new CustomerOrderRecord(o.Number, o.CreatedAt, JsonNamingPolicy.CamelCase.ConvertName(o.Status.ToString()), o.Total)).ToList();
    }
}
