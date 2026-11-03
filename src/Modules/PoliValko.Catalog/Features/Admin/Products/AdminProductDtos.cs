using Microsoft.AspNetCore.Mvc;
using PoliValko.Catalog.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Admin.Products;

public sealed record AdminProductListItemDto(
    Guid Id,
    string Sku,
    string Name,
    string? DisplayName,
    string Slug,
    string CategoryName,
    MoneyDto Price,
    decimal Stock,
    bool IsVisible,
    string? ImageUrl,
    bool HasDescription,
    DateTimeOffset UpdatedAt);

public sealed record AdminProductQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "categoryId")] Guid? CategoryId,
    [FromQuery(Name = "visible")] bool? Visible,
    [FromQuery(Name = "stock")] string? Stock,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

public sealed record SetProductsVisibilityRequest(IReadOnlyList<Guid>? ProductIds, bool? Visible);

public sealed record SetProductsVisibilityResult(int Updated);

public sealed record NavkoloProductFieldsDto(
    string NavkoloId,
    string Sku,
    string Name,
    string? GroupRef,
    MoneyDto Price,
    MoneyDto? OldPrice,
    decimal Stock,
    DateTimeOffset PriceUpdatedAt,
    DateTimeOffset StockUpdatedAt,
    string? VariantGroup,
    string? VariantLabel);

public sealed record AdminProductImageDto(Guid Id, string Url, string Alt, int SortOrder, string? Credit);

public sealed record AdminProductDto(
    Guid Id,
    NavkoloProductFieldsDto Navkolo,
    string? DisplayName,
    string Slug,
    Guid CategoryId,
    string? Brand,
    string? DescriptionHtml,
    bool IsVisible,
    string? SeoTitle,
    string? SeoDescription,
    IReadOnlyList<ProductAttributeDto> Attributes,
    IReadOnlyList<AdminProductImageDto> Images,
    DateTimeOffset UpdatedAt);

public sealed record UpdateProductRequest(
    string? DisplayName,
    string? Slug,
    Guid? CategoryId,
    string? Brand,
    string? DescriptionHtml,
    bool IsVisible,
    string? SeoTitle,
    string? SeoDescription,
    IReadOnlyList<ProductAttributeDto>? Attributes);

public sealed record ProductImageOrderItem(Guid Id, string? Alt);

public sealed record UpdateProductImagesRequest(IReadOnlyList<ProductImageOrderItem>? Images);
