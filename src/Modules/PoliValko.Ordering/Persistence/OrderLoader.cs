using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Persistence;

internal static class OrderLoader
{
    public static async Task<bool> MatchesAccessTokenAsync(PoliValkoDbContext db, string number, string? token, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(token)) return false;
        var hash = await db.Set<Order>().Where(o => o.Number == number).Select(o => o.AccessTokenHash).FirstOrDefaultAsync(ct);
        return hash is not null && OrderTokens.Matches(token, hash);
    }

    public static Task<Order?> LoadAsync(PoliValkoDbContext db, string number, bool tracking, CancellationToken ct, Guid? customerId = null)
    {
        var matchingOrder = db.Set<Order>().Where(o => o.Number == number);
        if (customerId is { } id) matchingOrder = matchingOrder.Where(o => o.CustomerId == id);

        var query = matchingOrder
            .Include(o => o.Items)
            .Include(o => o.History)
            .Include(o => o.Refunds).ThenInclude(r => r.Lines)
            .AsSplitQuery();
        return (tracking ? query : query.AsNoTracking()).FirstOrDefaultAsync(ct);
    }
}
