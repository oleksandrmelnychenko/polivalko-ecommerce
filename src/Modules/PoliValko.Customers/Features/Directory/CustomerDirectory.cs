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

    public async Task<IReadOnlyDictionary<Guid, CustomerBrief>> GetBriefsAsync(IReadOnlyCollection<Guid> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return new Dictionary<Guid, CustomerBrief>();
        var unique = ids.Distinct().ToArray();
        return await db.Set<Customer>()
            .AsNoTracking()
            .Where(c => unique.Contains(c.Id))
            .Select(c => new CustomerBrief(c.Id, c.Name, c.Phone, c.Email))
            .ToDictionaryAsync(c => c.Id, ct);
    }
}
