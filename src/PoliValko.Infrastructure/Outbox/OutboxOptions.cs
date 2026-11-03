namespace PoliValko.Infrastructure.Outbox;

public sealed class OutboxOptions
{
    public int BatchSize { get; set; } = 20;

    public int MaxAttempts { get; set; } = 10;

    public TimeSpan LockDuration { get; set; } = TimeSpan.FromMinutes(5);

    public TimeSpan PollInterval { get; set; } = TimeSpan.FromSeconds(2);
}
