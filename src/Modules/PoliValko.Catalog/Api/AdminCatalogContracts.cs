using Microsoft.AspNetCore.Mvc;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Api;

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

/// <summary><c>stock</c> — in (є в наявності), low (більше 0 і не більше 3), out (немає).</summary>
public sealed record AdminProductQuery(
    [FromQuery(Name = "q")] string? Q,
    [FromQuery(Name = "categoryId")] Guid? CategoryId,
    [FromQuery(Name = "visible")] bool? Visible,
    [FromQuery(Name = "stock")] string? Stock,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

/// <summary>Фільтр залишку в адмінці й поріг «закінчується» для зведення.</summary>
public static class ProductStockFilters
{
    public const string In = "in";
    public const string Low = "low";
    public const string Out = "out";

    /// <summary>Залишок, за якого товар вважається таким, що закінчується (включно).</summary>
    public const decimal LowStockThreshold = 3;

    public static readonly IReadOnlyList<string> All = [In, Low, Out];
}

/// <summary>Масова зміна видимості: від 1 до 200 товарів.</summary>
public sealed record SetProductsVisibilityRequest(IReadOnlyList<Guid>? ProductIds, bool? Visible);

/// <summary><see cref="Updated"/> — скільки товарів справді змінили видимість (уже приховані не рахуються).</summary>
public sealed record SetProductsVisibilityResult(int Updated);

/// <summary>Поля, що належать Navkolo: в адмінці лише для читання (розділ 9 ТЗ).</summary>
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

/// <summary>Лише поля сайту. Поля Navkolo цим запитом змінити неможливо.</summary>
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

public sealed record AttributeNameDto(string Name, int ProductCount);

public sealed record AdminCollectionDto(
    Guid Id,
    string Code,
    string Title,
    int SortOrder,
    bool IsVisible,
    IReadOnlyList<AdminProductListItemDto> Products);

public sealed record SaveCollectionRequest(string? Code, string? Title, int SortOrder, bool IsVisible, IReadOnlyList<Guid>? ProductIds);

public sealed record AdminRedirectDto(Guid Id, string FromPath, string ToPath, bool IsAutomatic, DateTimeOffset CreatedAt);

public sealed record CreateRedirectRequest(string? FromPath, string? ToPath);
