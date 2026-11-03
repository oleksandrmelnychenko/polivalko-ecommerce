namespace PoliValko.Catalog.Domain;

public sealed class Category
{
    public Guid Id { get; init; }

    public Guid? ParentId { get; set; }

    public required string Slug { get; set; }

    public required string Name { get; set; }

    public int SortOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    public string? NavkoloRef { get; set; }

    public List<string>? FilterAttributes { get; set; }

    public string? SeoTitle { get; set; }

    public string? SeoDescription { get; set; }
}
