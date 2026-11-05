namespace PoliValko.Catalog.Domain;

public sealed class ProductLabel
{
    public Guid Id { get; init; }

    public required string Name { get; set; }

    public LabelTone Tone { get; set; }

    public LabelKind Kind { get; init; }

    public int? NewDays { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; } = true;

    public bool AppliesTo(decimal amount, decimal? oldAmount, DateTimeOffset createdAt, bool linked, DateTimeOffset now) => Kind switch
    {
        LabelKind.Sale => oldAmount is { } old && old > amount,
        LabelKind.New => NewDays is { } days && createdAt >= now.AddDays(-days),
        _ => linked,
    };
}
