using PoliValko.Ordering.Contracts;

namespace PoliValko.Ordering.Domain;

public sealed class OrderStatusChange
{
    public const string NoteChanged = "Нотатка змінена";

    public Guid Id { get; init; }

    public Guid OrderId { get; init; }

    public OrderStatus? From { get; init; }

    public OrderStatus To { get; init; }

    public DateTimeOffset At { get; init; }

    public required string By { get; init; }

    public string? Reason { get; init; }

    public bool IsStatusChange => From != To;
}
