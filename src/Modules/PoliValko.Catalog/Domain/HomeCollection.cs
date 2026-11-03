namespace PoliValko.Catalog.Domain;

public sealed class HomeCollection
{
    public Guid Id { get; init; }

    public required string Code { get; set; }

    public required string Title { get; set; }

    public int SortOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    public List<Guid> ProductIds { get; set; } = [];
}
