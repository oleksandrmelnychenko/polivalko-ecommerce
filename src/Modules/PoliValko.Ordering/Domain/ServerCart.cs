namespace PoliValko.Ordering.Domain;

public sealed class ServerCart
{
    public Guid Id { get; init; } = Guid.CreateVersion7();
    public required string Owner { get; init; }
    public long Revision { get; set; }
    public string ItemsJson { get; set; } = "[]";
    public DateTimeOffset UpdatedAt { get; set; }
    public long? CheckoutRevision { get; set; }
    public string? ProtectedCheckoutResult { get; set; }
}
