using System.Text.Json;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Outbox;

/// <summary>Повідомлення для фонової обробки. <see cref="Type"/> — стабільна назва, що зберігається в БД.</summary>
public interface IOutboxMessage
{
    static abstract string Type { get; }
}

public interface IOutboxHandler<in TMessage>
    where TMessage : IOutboxMessage
{
    Task HandleAsync(TMessage message, CancellationToken cancellationToken);
}

/// <summary>
/// Додає повідомлення в поточний <see cref="PoliValkoDbContext"/>. Воно зберігається тим самим
/// <c>SaveChangesAsync</c>, що й бізнес-зміни, тобто атомарно.
/// </summary>
public interface IOutbox
{
    void Enqueue<TMessage>(TMessage message)
        where TMessage : IOutboxMessage;
}

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

internal static class OutboxJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
}
