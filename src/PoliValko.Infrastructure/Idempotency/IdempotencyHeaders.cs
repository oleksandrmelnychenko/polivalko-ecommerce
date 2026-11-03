namespace PoliValko.Infrastructure.Idempotency;

public static class IdempotencyHeaders
{
    public const string Key = "Idempotency-Key";
    public const string Replayed = "Idempotent-Replayed";
}
