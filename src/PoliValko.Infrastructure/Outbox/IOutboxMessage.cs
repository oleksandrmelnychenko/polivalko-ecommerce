namespace PoliValko.Infrastructure.Outbox;

public interface IOutboxMessage
{
    static abstract string Type { get; }
}
