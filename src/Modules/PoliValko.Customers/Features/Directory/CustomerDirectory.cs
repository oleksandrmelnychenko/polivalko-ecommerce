using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Directory;

internal sealed class CustomerDirectory(PoliValkoDbContext db) : ICustomerDirectory
{
    public async Task<Guid?> FindConfirmedIdByEmailAsync(string email, CancellationToken ct)
    {
        var normalized = CustomerEmail.Normalize(email);
        return await db.Set<Customer>()
            .AsNoTracking()
            .Where(c => c.NormalizedEmail == normalized && c.EmailConfirmedAt != null)
            .Select(c => (Guid?)c.Id)
            .FirstOrDefaultAsync(ct);
    }
}
