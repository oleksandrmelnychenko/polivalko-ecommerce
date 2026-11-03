namespace PoliValko.Catalog.Contracts;

public sealed record NavkoloProductRecord(
    string? NavkoloId,
    string? Sku,
    string? Name,
    string? GroupRef,
    decimal? Price,
    decimal? OldPrice,
    decimal? Stock,
    string? Brand = null,
    string? VariantGroup = null,
    string? VariantLabel = null,
    string? Description = null,
    IReadOnlyList<ProductAttributeDto>? Attributes = null,
    IReadOnlyList<string>? ImageUrls = null);
