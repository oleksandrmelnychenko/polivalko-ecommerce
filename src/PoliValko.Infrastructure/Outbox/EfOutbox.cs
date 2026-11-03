using System.Text.Json;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Outbox;

internal sealed class EfOutbox(PoliValkoDbContext db, TimeProvider time) : IOutbox
{
    public void Enqueue<TMessage>(TMessage message)
        where TMessage : IOutboxMessage
    {
        var now = time.GetUtcNow();
        db.OutboxMessages.Add(new OutboxMessage
        {
            Id = Guid.CreateVersion7(now),
            Type = TMessage.Type,
            Payload = JsonSerializer.Serialize(message, OutboxJson.Options),
            OccurredAt = now,
            NextAttemptAt = now,
            Status = OutboxStatus.Pending,
        });
    }
}
