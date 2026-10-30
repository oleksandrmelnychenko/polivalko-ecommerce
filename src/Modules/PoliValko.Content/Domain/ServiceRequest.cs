namespace PoliValko.Content.Domain;

public enum ServiceRequestStatus
{
    New,
    InProgress,
    Done,
}

/// <summary>Заявка на послугу з форми на сайті (розділ 8 ТЗ).</summary>
public sealed class ServiceRequest
{
    public Guid Id { get; init; }

    public required string Name { get; init; }

    /// <summary>Телефон у форматі E.164 (+380XXXXXXXXX).</summary>
    public required string Phone { get; init; }

    public required string DirectionCode { get; init; }

    public string? Comment { get; init; }

    public ServiceRequestStatus Status { get; set; }

    public DateTimeOffset CreatedAt { get; init; }
}
