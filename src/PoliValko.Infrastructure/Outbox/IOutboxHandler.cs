namespace PoliValko.Infrastructure.Outbox;

public interface IOutboxHandler<in TMessage>
    where TMessage : IOutboxMessage
{
    Task HandleAsync(TMessage message, CancellationToken cancellationToken);
}
