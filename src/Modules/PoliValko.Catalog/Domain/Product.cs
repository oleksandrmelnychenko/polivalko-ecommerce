namespace PoliValko.Catalog.Domain;

public sealed class Product
{
    public Guid Id { get; init; }

    public required string NavkoloId { get; init; }

    public required string Sku { get; set; }

    public required string Name { get; set; }

    public string? NavkoloGroupRef { get; set; }

    public string? VariantGroup { get; set; }

    public string? VariantLabel { get; set; }

    public string? DisplayName { get; set; }

    public required string Slug { get; set; }

    public Guid CategoryId { get; set; }

    public string? Brand { get; set; }

    public string? DescriptionHtml { get; set; }

    public bool IsVisible { get; set; }

    public string? SeoTitle { get; set; }

    public string? SeoDescription { get; set; }

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }

    public ProductPrice Price { get; set; } = null!;

    public ProductStock Stock { get; set; } = null!;

    public List<ProductImage> Images { get; set; } = [];

    public List<ProductAttribute> Attributes { get; set; } = [];
}
