using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Persistence;

internal static class OrderLoader
{
    public static Task<Order?> LoadAsync(PoliValkoDbContext db, string number, bool tracking, CancellationToken ct)
    {
        var query = db.Set<Order>()
            .Include(o => o.Items)
            .Include(o => o.History)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery();
        return (tracking ? query : query.AsNoTracking()).FirstOrDefaultAsync(o => o.Number == number, ct);
    }
}
