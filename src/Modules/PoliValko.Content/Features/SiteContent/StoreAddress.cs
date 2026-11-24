using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Contracts;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Content.Features.SiteContent;

internal sealed class StoreAddress(PoliValkoDbContext db) : IStoreAddress
{
    public Task<string?> ReadAsync(CancellationToken ct) =>
        db.Set<SiteContacts>().Where(c => c.Id == SiteContacts.SingletonId)
            .Select(c => c.Address).FirstOrDefaultAsync(ct);
}
