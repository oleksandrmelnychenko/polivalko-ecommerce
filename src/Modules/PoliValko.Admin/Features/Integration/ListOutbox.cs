using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Admin.Features.Integration;

internal static class ListOutbox
{
    public static async Task<Ok<List<OutboxMessageDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct) =>
        TypedResults.Ok(await db.OutboxMessages
            .AsNoTracking()
            .Where(m => m.Status == OutboxStatus.Failed || (m.Status == OutboxStatus.Pending && m.Attempts > 0))
            .OrderByDescending(m => m.OccurredAt)
            .Take(100)
            .Select(m => new OutboxMessageDto(m.Id, m.Type, m.OccurredAt, m.Status, m.Attempts, m.NextAttemptAt, m.LastError))
            .ToListAsync(ct));
}
