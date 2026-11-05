namespace PoliValko.Catalog.Domain;

public sealed class Brand
{
    public const int MaxNameLength = 200;

    public Guid Id { get; init; }

    public string Name { get; private set; } = string.Empty;

    public string NormalizedName { get; private set; } = string.Empty;

    public required string Slug { get; set; }

    public string? Description { get; set; }

    public string? LogoUrl { get; set; }

    public static string Normalize(string name) => name.Trim().ToUpperInvariant();

    public void Rename(string name)
    {
        Name = name.Trim();
        NormalizedName = Normalize(name);
    }
}
