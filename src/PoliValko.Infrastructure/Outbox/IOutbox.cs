namespace PoliValko.Infrastructure.Outbox;

public interface IOutbox
{
    void Enqueue<TMessage>(TMessage message)
        where TMessage : IOutboxMessage;
}
