namespace PoliValko.Infrastructure.Outbox;

public static class OutboxRetryPolicy
{
    private static readonly TimeSpan[] Delays =
    [
        TimeSpan.FromMinutes(1),
        TimeSpan.FromMinutes(5),
        TimeSpan.FromMinutes(15),
        TimeSpan.FromHours(1),
        TimeSpan.FromHours(3),
        TimeSpan.FromHours(6),
    ];

    public static TimeSpan NextDelay(int attempts) => Delays[Math.Clamp(attempts, 1, Delays.Length) - 1];
}
