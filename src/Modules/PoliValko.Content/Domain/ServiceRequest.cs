namespace PoliValko.Content.Domain;

public sealed class ServiceRequest
{
    public Guid Id { get; init; }

    public required string Name { get; init; }

    public required string Phone { get; init; }

    public required string DirectionCode { get; init; }

    public string[] AdditionalDirectionCodes { get; init; } = [];

    public string[] GetDirectionNames() => Enumerable.Repeat(DirectionCode, 1)
        .Concat(AdditionalDirectionCodes)
        .Select(code => ServiceDirections.Find(code)?.Name ?? code)
        .ToArray();

    public string? Comment { get; init; }

    public ServiceRequestStatus Status { get; set; }

    public DateTimeOffset CreatedAt { get; init; }
}
