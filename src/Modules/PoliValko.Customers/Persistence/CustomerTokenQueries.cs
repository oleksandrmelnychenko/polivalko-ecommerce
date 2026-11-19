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
        CancellationToken ct,
        bool tracking = true)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > 200)
        {
            return null;
        }

        var hash = CustomerToken.Hash(value.Trim());
        var tokens = db.Set<CustomerToken>().Where(t => t.TokenHash == hash && t.Purpose == purpose && t.UsedAt == null && t.ExpiresAt > now);
        return await (tracking ? tokens : tokens.AsNoTracking()).FirstOrDefaultAsync(ct);
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
