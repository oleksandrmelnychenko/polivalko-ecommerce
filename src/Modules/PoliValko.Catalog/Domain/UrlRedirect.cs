namespace PoliValko.Catalog.Domain;

public sealed class UrlRedirect
{
    public Guid Id { get; init; }

    public required string FromPath { get; set; }

    public required string ToPath { get; set; }

    public bool IsAutomatic { get; init; }

    public DateTimeOffset CreatedAt { get; init; }
}
