using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Persistence;

internal static class CustomerLoader
{
    public static async Task<Customer?> LoadAsync(PoliValkoDbContext db, ClaimsPrincipal user, CancellationToken ct) =>
        user.CustomerId() is { } id ? await db.Set<Customer>().FirstOrDefaultAsync(c => c.Id == id, ct) : null;
}
