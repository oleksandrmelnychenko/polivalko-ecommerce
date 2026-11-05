namespace PoliValko.Catalog.Domain;

public sealed class AttributeDefinition
{
    public const int MaxNameLength = 100;

    public Guid Id { get; init; }

    public string Name { get; private set; } = string.Empty;

    public string NormalizedName { get; private set; } = string.Empty;

    public string? Unit { get; set; }

    public AttributeKind Kind { get; set; }

    public AttributeFilterView FilterView { get; set; }

    public int SortOrder { get; set; }

    public List<string> Aliases { get; set; } = [];

    public static string Normalize(string name) => name.Trim().ToUpperInvariant();

    public void Rename(string name)
    {
        Name = name.Trim();
        NormalizedName = Normalize(name);
    }
}
