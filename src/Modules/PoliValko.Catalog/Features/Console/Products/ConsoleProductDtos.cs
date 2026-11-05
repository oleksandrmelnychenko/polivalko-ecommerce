using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Console.Products;

public sealed record ConsoleProductListItemDto(
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
    DateTimeOffset UpdatedAt,
    IReadOnlyList<ConsoleProductLabelDto> Labels);

public sealed record ConsoleProductLabelDto(Guid Id, string Name, LabelTone Tone, LabelKind Kind);

public sealed record ConsoleProductQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "categoryId")] Guid? CategoryId,
    [FromQuery(Name = "visible")] bool? Visible,
    [FromQuery(Name = "stock")] string? Stock,
    [FromQuery(Name = "brand")] string? Brand,
    [FromQuery(Name = "labelId")] Guid? LabelId,
    [property: Description("missing-photo | missing-description | missing-attributes | any-missing")] [FromQuery(Name = "fill")] string? Fill,
    [property: Description("Створені за останні N днів")] [FromQuery(Name = "newDays")] int? NewDays,
    [property: Description("Приховані товари, що є в наявності")] [FromQuery(Name = "hiddenWithStock")] bool? HiddenWithStock,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

public sealed record SetProductsVisibilityRequest(IReadOnlyList<Guid>? ProductIds, bool? Visible);

public sealed record SetProductsVisibilityResult(int Updated);

public sealed record ConsoleProductCountsDto(int All, int NeedsFilling, int Recent30, int HiddenWithStock, int OutOfStock);

public sealed record BulkUpdateProductsRequest(
    IReadOnlyList<Guid>? ProductIds,
    Guid? CategoryId,
    string? Brand,
    IReadOnlyList<Guid>? AddLabelIds,
    IReadOnlyList<Guid>? RemoveLabelIds,
    bool? IsVisible);

public sealed record BulkUpdateProductsResult(int Updated);

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

public sealed record ConsoleProductImageDto(Guid Id, string Url, string Alt, int SortOrder, string? Credit);

public sealed record ConsoleProductDto(
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
    IReadOnlyList<ConsoleProductImageDto> Images,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<Guid> LabelIds,
    IReadOnlyList<ConsoleProductLabelDto> Labels,
    DateTimeOffset CreatedAt);

public sealed record UpdateProductRequest(
    string? DisplayName,
    string? Slug,
    Guid? CategoryId,
    string? Brand,
    string? DescriptionHtml,
    bool IsVisible,
    string? SeoTitle,
    string? SeoDescription,
    IReadOnlyList<ProductAttributeDto>? Attributes,
    IReadOnlyList<Guid>? LabelIds = null);

public sealed record ProductImageOrderItem(Guid Id, string? Alt);

public sealed record UpdateProductImagesRequest(IReadOnlyList<ProductImageOrderItem>? Images);
