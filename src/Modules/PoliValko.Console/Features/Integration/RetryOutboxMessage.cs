using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Console.Features.Integration;

internal static class RetryOutboxMessage
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var message = await db.OutboxMessages.FirstOrDefaultAsync(m => m.Id == id && m.Status != OutboxStatus.Processed, ct);
        if (message is null)
        {
            return Problems.NotFound("integration.message_not_found", "Операцію не знайдено або її вже виконано");
        }

        message.Status = OutboxStatus.Pending;
        message.Attempts = 0;
        message.NextAttemptAt = time.GetUtcNow();
        message.LockedUntil = null;
        audit.Record("integration.outbox_retried", "OutboxMessage", id.ToString(), new { message.Type });
        await db.SaveChangesAsync(ct);
        return TypedResults.NoContent();
    }
}
