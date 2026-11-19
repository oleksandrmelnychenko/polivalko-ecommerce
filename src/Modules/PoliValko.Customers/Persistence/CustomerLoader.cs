using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Persistence;

internal static class CustomerLoader
{
    public static async Task<Customer?> LoadAsync(PoliValkoDbContext db, ClaimsPrincipal user, CancellationToken ct, bool forUpdate = false)
    {
        var id = user.CustomerId();
        var stamp = user.FindFirst(CustomerClaims.SecurityStamp)?.Value;
        if (id is null || stamp is null)
        {
            return null;
        }

        if (!forUpdate)
        {
            return await db.Set<Customer>().FirstOrDefaultAsync(c => c.Id == id.Value && c.SecurityStamp == stamp && c.BlockedAt == null, ct);
        }

        var customer = await LockByIdAsync(db, id.Value, ct);
        return customer is not null && customer.SecurityStamp == stamp && customer.BlockedAt is null ? customer : null;
    }

    public static Task<Customer?> LockByIdAsync(PoliValkoDbContext db, Guid id, CancellationToken ct) =>
        db.Set<Customer>().FromSql($"SELECT * FROM customers.customers WHERE id = {id} FOR UPDATE").FirstOrDefaultAsync(ct);
}
