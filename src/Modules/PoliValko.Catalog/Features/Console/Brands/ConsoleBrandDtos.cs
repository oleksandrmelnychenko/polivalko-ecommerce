namespace PoliValko.Catalog.Features.Console.Brands;

public sealed record BrandDto(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string? LogoUrl,
    int ProductCount);

public sealed record SaveBrandRequest(string? Name, string? Slug, string? Description, string? LogoUrl);

public sealed record MergeBrandRequest(Guid? IntoId);
