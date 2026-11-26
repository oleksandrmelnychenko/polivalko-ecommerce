using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

public sealed record CategoryNodeDto(Guid Id, string Slug, string Name, IReadOnlyList<CategoryNodeDto> Children, string? ImageUrl, string? Description);

public sealed record CategoryRefDto(Guid Id, string Slug, string Name);

public sealed record CategoryDto(
    Guid Id,
    string Slug,
    string Name,
    IReadOnlyList<CategoryRefDto> Breadcrumbs,
    IReadOnlyList<CategoryRefDto> Children,
    string? SeoTitle,
    string? SeoDescription,
    string? ImageUrl,
    string? Description);

public sealed record ProductLabelBadgeDto(string Name, LabelTone Tone, LabelKind Kind);

public sealed record ProductListItemDto(
    Guid Id,
    Guid CategoryId,
    string Slug,
    string Sku,
    string Name,
    string? Brand,
    MoneyDto Price,
    MoneyDto? OldPrice,
    bool InStock,
    string? ImageUrl,
    IReadOnlyList<ProductLabelBadgeDto> Labels,
    [property: Description("Скільки фасувань у групі товару; 0, якщо товар не в групі")] int PackSizes = 0,
    [property: Description("Найнижча ціна серед фасувань, якщо вони коштують по-різному")] MoneyDto? PriceFrom = null);

public sealed record ProductImageDto(string Url, string Alt);

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
    string? SeoDescription,
    IReadOnlyList<ProductLabelBadgeDto> Labels,
    [property: Description("Адреса сторінки бренду; null, якщо в бренду немає своєї сторінки")] string? BrandSlug = null);

public sealed record BrandFacet(string Name, int Count);

public sealed record AttributeValueFacet(string Value, int Count);

public sealed record AttributeFacet(string Name, IReadOnlyList<AttributeValueFacet> Values);

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
    ProductFacets Facets,
    bool Approximate);

public sealed record PhotoCreditDto(string Credit, string Url);

public sealed record CollectionDto(string Code, string Title, IReadOnlyList<ProductListItemDto> Items);

public sealed record SitemapEntryDto(string Slug, DateTimeOffset UpdatedAt);

/// <summary>What a product feed for a shopping service needs to know about one product.</summary>
public sealed record MerchantFeedItemDto(
    Guid Id,
    string Slug,
    string Sku,
    string Name,
    string? Brand,
    string? DescriptionHtml,
    MoneyDto Price,
    MoneyDto? OldPrice,
    bool InStock,
    IReadOnlyList<string> CategoryPath,
    IReadOnlyList<string> Images,
    IReadOnlyList<ProductAttributeDto> Attributes);

public sealed record SitemapDto(IReadOnlyList<SitemapEntryDto> Categories, IReadOnlyList<SitemapEntryDto> Products, IReadOnlyList<SitemapEntryDto> Brands);

public sealed record BrandSummaryDto(string Name, string Slug, string? LogoUrl, int ProductCount);

/// <summary>A brand with its own storefront page; its products come from the product search with <c>brandPage</c>.</summary>
public sealed record BrandPageDto(string Name, string Slug, string? Description, string? LogoUrl, int ProductCount, DateTimeOffset UpdatedAt);

public sealed record RedirectDto(string From, string To);

public sealed record ProductSearchQuery(
    [property: Description("Пошук за назвою або точним артикулом")] [FromQuery(Name = "q")] string? Q,
    [property: Description("Slug категорії; включає підкатегорії")] [FromQuery(Name = "category")] string? Category,
    [property: Description("Бренди через кому, точний збіг")] [FromQuery(Name = "brand")] string? Brand,
    [property: Description("Slug сторінки бренду: лише товари цього бренду, у будь-якому написанні")] [FromQuery(Name = "brandPage")] string? BrandPage,
    [FromQuery(Name = "inStock")] bool? InStock,
    [property: Description("Лише товари зі старою ціною, більшою за поточну")] [FromQuery(Name = "onSale")] bool? OnSale,
    [FromQuery(Name = "priceMin")] decimal? PriceMin,
    [FromQuery(Name = "priceMax")] decimal? PriceMax,
    [property: Description("Характеристики у форматі Назва:Значення; кілька значень однієї назви — АБО, різні назви — І")] [FromQuery(Name = "f")] string[]? F,
    [property: Description("Типово — активний режим вітрини. seasonal | stock_cover | name_asc | name_desc | price_asc | price_desc")] [FromQuery(Name = "sort")] string? Sort,
    [FromQuery(Name = "page")] int? Page,
    [FromQuery(Name = "pageSize")] int? PageSize);

public static class ProductSort
{
    public const string Seasonal = "seasonal";
    public const string StockCover = "stock_cover";
    public static bool IsMode(string? mode) => mode is Seasonal or StockCover;
    public const string NameAsc = "name_asc";
    public const string NameDesc = "name_desc";
    public const string PriceAsc = "price_asc";
    public const string PriceDesc = "price_desc";

    public static readonly string[] All = [Seasonal, StockCover, NameAsc, NameDesc, PriceAsc, PriceDesc];
}
