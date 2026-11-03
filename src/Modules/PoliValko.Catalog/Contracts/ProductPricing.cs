namespace PoliValko.Catalog.Contracts;

public sealed record ProductPricing(
    Guid Id,
    string Slug,
    string Sku,
    string Name,
    string? ImageUrl,
    decimal Price,
    decimal Stock,
    bool IsVisible);
