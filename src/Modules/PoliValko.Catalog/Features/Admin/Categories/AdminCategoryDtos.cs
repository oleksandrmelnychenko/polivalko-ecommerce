namespace PoliValko.Catalog.Features.Admin.Categories;

public sealed record AdminCategoryDto(
    Guid Id,
    Guid? ParentId,
    string Slug,
    string Name,
    int SortOrder,
    bool IsVisible,
    string? NavkoloRef,
    IReadOnlyList<string> FilterAttributes,
    string? SeoTitle,
    string? SeoDescription,
    int ProductCount);

public sealed record SaveCategoryRequest(
    Guid? ParentId,
    string? Name,
    string? Slug,
    int SortOrder,
    bool IsVisible,
    string? NavkoloRef,
    IReadOnlyList<string>? FilterAttributes,
    string? SeoTitle,
    string? SeoDescription);
