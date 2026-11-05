namespace PoliValko.Catalog.Features.Console.Categories;

public sealed record ConsoleCategoryDto(
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
    int ProductCount,
    string? ImageUrl,
    string? Description);

public sealed record SaveCategoryRequest(
    Guid? ParentId,
    string? Name,
    string? Slug,
    int SortOrder,
    bool IsVisible,
    string? NavkoloRef,
    IReadOnlyList<string>? FilterAttributes,
    string? SeoTitle,
    string? SeoDescription,
    string? ImageUrl = null,
    string? Description = null);
