using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Account;

internal sealed class LinkGuestOrders(PoliValkoDbContext db) : ICustomerEmailConfirmedHandler
{
    public async Task OnEmailConfirmedAsync(Guid customerId, string email, CancellationToken ct)
    {
        var normalized = email.Trim().ToUpperInvariant();
        var orders = await db.Set<Order>()
            .Where(o => o.CustomerId == null && o.CustomerEmail != null && o.CustomerEmail.ToUpper() == normalized)
            .ToListAsync(ct);
        foreach (var order in orders)
        {
            order.LinkCustomer(customerId);
        }
    }
}
