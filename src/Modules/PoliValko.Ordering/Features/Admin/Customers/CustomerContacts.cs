using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Admin.Customers;

internal static class CustomerContacts
{
    public static async Task<Dictionary<string, CustomerContact>> LoadContactsAsync(
        PoliValkoDbContext db,
        IReadOnlyCollection<string> phones,
        CancellationToken ct)
    {
        if (phones.Count == 0)
        {
            return [];
        }

        var orders = await db.Set<Order>().AsNoTracking()
            .Where(o => phones.Contains(o.CustomerPhone))
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)
            .Select(o => new { o.CustomerPhone, o.CustomerName, o.CustomerEmail, o.Number })
            .ToListAsync(ct);

        return orders
            .GroupBy(o => o.CustomerPhone)
            .ToDictionary(
                g => g.Key,
                g => new CustomerContact(
                    g.First().CustomerName,
                    g.Select(o => o.CustomerEmail).FirstOrDefault(e => !string.IsNullOrWhiteSpace(e)),
                    g.First().Number));
    }
}
