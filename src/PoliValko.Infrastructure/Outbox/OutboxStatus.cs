namespace PoliValko.Infrastructure.Outbox;

public enum OutboxStatus
{
    Pending,
    Processed,

    Failed,
}
