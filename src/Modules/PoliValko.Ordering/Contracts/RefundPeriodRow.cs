namespace PoliValko.Ordering.Contracts;

public sealed record RefundPeriodRow(DateTimeOffset CompletedAt, decimal Amount);
