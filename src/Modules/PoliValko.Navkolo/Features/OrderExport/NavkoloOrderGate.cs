using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Navkolo.Features.OrderExport;

// Session lock spans committed "attempt started", remote I/O and its acknowledgement.
// Multiple workers cannot let a late export overwrite an already synchronized cancellation.
internal sealed class NavkoloOrderGate(PoliValkoDbContext db)
{
    public async Task LockForSyncAsync(IReadOnlyCollection<Guid> orderIds, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Order sync requires a transaction.");
        // Same keys as outbound session locks. Always acquire gates before order and stock rows.
        foreach (var id in orderIds.Distinct().Order())
        {
            var key = $"navkolo.order:{id}";
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({key}, 0))", ct);
        }
    }

    public async Task RunAsync(Guid orderId, Func<Task> action, CancellationToken ct)
    {
        var key = $"navkolo.order:{orderId}";
        await db.Database.OpenConnectionAsync(ct);
        try
        {
            await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_lock(hashtextextended({key}, 0))", ct);
            await action();
        }
        finally
        {
            try { await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_unlock(hashtextextended({key}, 0))", CancellationToken.None); }
            finally { await db.Database.CloseConnectionAsync(); }
        }
    }
}
