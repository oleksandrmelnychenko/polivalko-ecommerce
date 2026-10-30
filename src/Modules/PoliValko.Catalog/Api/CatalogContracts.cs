using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Api;

public sealed record CategoryNodeDto(Guid Id, string Slug, string Name, IReadOnlyList<CategoryNodeDto> Children);

public sealed record CategoryRefDto(Guid Id, string Slug, string Name);

public sealed record CategoryDto(
    Guid Id,
    string Slug,
    string Name,
    IReadOnlyList<CategoryRefDto> Breadcrumbs,
    IReadOnlyList<CategoryRefDto> Children,
    string? SeoTitle,
    string? SeoDescription);

public sealed record ProductListItemDto(
    Guid Id,
    string Slug,
    string Sku,
    string Name,
    string? Brand,
    MoneyDto Price,
    MoneyDto? OldPrice,
    bool InStock,
    string? ImageUrl);

public sealed record ProductImageDto(string Url, string Alt);

public sealed record ProductAttributeDto(string Name, string Value);

/// <summary>Варіант товару (інший обліковий SKU тієї ж групи), напр. інша довжина шланга.</summary>
public sealed record ProductVariantDto(string Slug, string Label, bool InStock, bool IsCurrent);

public sealed record ProductDetailsDto(
    Guid Id,
    string Slug,
    string Sku,
    string Name,
    string? Brand,
    string? DescriptionHtml,
    MoneyDto Price,
    MoneyDto? OldPrice,
    bool InStock,
    CategoryRefDto Category,
    IReadOnlyList<ProductImageDto> Images,
    IReadOnlyList<ProductAttributeDto> Attributes,
    IReadOnlyList<ProductVariantDto> Variants,
    string? SeoTitle,
    string? SeoDescription);

public sealed record BrandFacet(string Name, int Count);

public sealed record AttributeValueFacet(string Value, int Count);

/// <summary>Фільтр за характеристикою з погодженого переліку розділу.</summary>
public sealed record AttributeFacet(string Name, IReadOnlyList<AttributeValueFacet> Values);

/// <summary>Фасети рахуються за категорією й пошуковим запитом, без урахування решти фільтрів.</summary>
public sealed record ProductFacets(
    IReadOnlyList<BrandFacet> Brands,
    MoneyDto? PriceMin,
    MoneyDto? PriceMax,
    int InStockCount,
    IReadOnlyList<AttributeFacet> Attributes);

public sealed record ProductSearchResponse(
    IReadOnlyList<ProductListItemDto> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    ProductFacets Facets);

public sealed record PhotoCreditDto(string Credit, string Url);

public sealed record CollectionDto(string Code, string Title, IReadOnlyList<ProductListItemDto> Items);

public sealed record SitemapEntryDto(string Slug, DateTimeOffset UpdatedAt);

public sealed record SitemapDto(IReadOnlyList<SitemapEntryDto> Categories, IReadOnlyList<SitemapEntryDto> Products);

public sealed record RedirectDto(string From, string To);

public sealed record ProductSearchQuery(
    [property: Description("Пошук за назвою або точним артикулом")] [FromQuery(Name = "q")] string? Q,
    [property: Description("Slug категорії; включає підкатегорії")] [FromQuery(Name = "category")] string? Category,
    [property: Description("Бренди через кому, точний збіг")] [FromQuery(Name = "brand")] string? Brand,
    [FromQuery(Name = "inStock")] bool? InStock,
    [property: Description("Лише товари зі старою ціною, більшою за поточну")] [FromQuery(Name = "onSale")] bool? OnSale,
    [FromQuery(Name = "priceMin")] decimal? PriceMin,
    [FromQuery(Name = "priceMax")] decimal? PriceMax,
    [property: Description("Характеристики у форматі Назва:Значення; кілька значень однієї назви — АБО, різні назви — І")] [FromQuery(Name = "f")] string[]? F,
    [property: Description("name_asc | name_desc | price_asc | price_desc")] [FromQuery(Name = "sort")] string? Sort,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

public static class ProductSort
{
    public const string NameAsc = "name_asc";
    public const string NameDesc = "name_desc";
    public const string PriceAsc = "price_asc";
    public const string PriceDesc = "price_desc";

    public static readonly string[] All = [NameAsc, NameDesc, PriceAsc, PriceDesc];
}
