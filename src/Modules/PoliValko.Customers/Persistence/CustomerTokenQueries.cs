using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Persistence;

internal static class CustomerTokenQueries
{
    public static async Task<CustomerToken?> FindUsableAsync(
        PoliValkoDbContext db,
        string? value,
        CustomerTokenPurpose purpose,
        DateTimeOffset now,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 200)
        {
            return null;
        }

        var hash = CustomerToken.Hash(value.Trim());
        var token = await db.Set<CustomerToken>().FirstOrDefaultAsync(t => t.TokenHash == hash && t.Purpose == purpose, ct);
        return token is not null && token.IsUsable(now) ? token : null;
    }

    public static async Task RevokeOpenAsync(
        PoliValkoDbContext db,
        Guid customerId,
        CustomerTokenPurpose purpose,
        DateTimeOffset now,
        CancellationToken ct)
    {
        var open = await db.Set<CustomerToken>()
            .Where(t => t.CustomerId == customerId && t.Purpose == purpose && t.UsedAt == null)
            .ToListAsync(ct);
        foreach (var token in open)
        {
            token.UsedAt = now;
        }
    }
}
