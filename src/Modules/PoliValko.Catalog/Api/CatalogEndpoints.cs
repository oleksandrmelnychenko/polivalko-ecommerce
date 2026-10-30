using System.Globalization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Api;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Catalog");

        group.MapGet("/categories", GetCategoryTreeAsync)
            .WithName("GetCategoryTree")
            .WithSummary("Дерево видимих категорій");

        group.MapGet("/categories/{slug}", GetCategoryAsync)
            .WithName("GetCategory")
            .WithSummary("Категорія з хлібними крихтами та підкатегоріями")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/products", SearchProductsAsync)
            .WithName("SearchProducts")
            .WithSummary("Пошук, фільтри, сортування й пагінація товарів із фасетами")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/products/{slug}", GetProductAsync)
            .WithName("GetProduct")
            .WithSummary("Картка товару")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/catalog/photo-credits", GetPhotoCreditsAsync)
            .WithName("GetPhotoCredits")
            .WithSummary("Автори й ліцензії фото товарів з відкритих джерел");

        group.MapGet("/collections", GetCollectionsAsync)
            .WithName("GetCollections")
            .WithSummary("Редакційні добірки головної з видимими товарами в погодженому порядку");

        group.MapGet("/catalog/sitemap", GetSitemapAsync)
            .WithName("GetSitemap")
            .WithSummary("Адреси видимих розділів і товарів для sitemap.xml");

        group.MapGet("/redirects/resolve", ResolveRedirectAsync)
            .WithName("ResolveRedirect")
            .WithSummary("Нова адреса для старого опублікованого шляху (постійне перенаправлення)")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return api;
    }

    private static async Task<Ok<IReadOnlyList<CategoryNodeDto>>> GetCategoryTreeAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var categories = await LoadVisibleCategoriesAsync(db, ct);
        var byParent = categories.ToLookup(c => c.ParentId);

        IReadOnlyList<CategoryNodeDto> Build(Guid? parentId) =>
            byParent[parentId].Select(c => new CategoryNodeDto(c.Id, c.Slug, c.Name, Build(c.Id))).ToList();

        return TypedResults.Ok(Build(null));
    }

    private static async Task<Results<Ok<CategoryDto>, ProblemHttpResult>> GetCategoryAsync(
        string slug,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var categories = await LoadVisibleCategoriesAsync(db, ct);
        var category = categories.FirstOrDefault(c => c.Slug == slug);
        if (category is null)
        {
            return CategoryNotFound(slug);
        }

        var byId = categories.ToDictionary(c => c.Id);
        var breadcrumbs = new List<CategoryRefDto>();
        for (var parentId = category.ParentId; parentId is { } id && byId.TryGetValue(id, out var parent); parentId = parent.ParentId)
        {
            breadcrumbs.Insert(0, ToRef(parent));
        }

        var children = categories.Where(c => c.ParentId == category.Id).Select(ToRef).ToList();
        return TypedResults.Ok(new CategoryDto(category.Id, category.Slug, category.Name, breadcrumbs, children, category.SeoTitle, category.SeoDescription));
    }

    private static async Task<Results<Ok<ProductSearchResponse>, ValidationProblem, ProblemHttpResult>> SearchProductsAsync(
        [AsParameters] ProductSearchQuery query,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var sort = query.Sort ?? ProductSort.NameAsc;
        if (!ProductSort.All.Contains(sort))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["sort"] = [$"Допустимі значення: {string.Join(", ", ProductSort.All)}."],
            });
        }

        var attributeFilters = ParseAttributeFilters(query.F);
        if (attributeFilters is null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["f"] = ["Фільтр характеристики має формат Назва:Значення."],
            });
        }

        // База для фасетів: видимі товари категорії та пошукового запиту.
        var scope = db.Set<Product>().AsNoTracking().Where(p => p.IsVisible);
        IReadOnlyList<string> filterNames = [];

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var categories = await LoadVisibleCategoriesAsync(db, ct);
            var root = categories.FirstOrDefault(c => c.Slug == query.Category);
            if (root is null)
            {
                return CategoryNotFound(query.Category);
            }

            var ids = Descendants(root.Id, categories.ToLookup(c => c.ParentId)).Append(root.Id).ToList();
            scope = scope.Where(p => ids.Contains(p.CategoryId));
            filterNames = FilterAttributesOf(root, categories.ToDictionary(c => c.Id));
        }

        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var pattern = $"%{EscapeLike(term)}%";
            scope = scope.Where(p => p.Sku == term || EF.Functions.ILike(p.Name, pattern, "\\"));
        }

        var facets = await BuildFacetsAsync(scope, filterNames, ct);

        var products = scope;
        var brands = (query.Brand ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
        if (brands.Count > 0)
        {
            products = products.Where(p => p.Brand != null && brands.Contains(p.Brand));
        }

        if (query.InStock == true)
        {
            products = products.Where(p => p.Stock.Quantity > 0);
        }

        if (query.OnSale == true)
        {
            products = products.Where(p => p.Price.OldAmount != null && p.Price.OldAmount > p.Price.Amount);
        }

        foreach (var (name, values) in attributeFilters)
        {
            products = products.Where(p => p.Attributes.Any(a => a.Name == name && values.Contains(a.Value)));
        }

        if (query.PriceMin is { } min)
        {
            products = products.Where(p => p.Price.Amount >= min);
        }

        if (query.PriceMax is { } max)
        {
            products = products.Where(p => p.Price.Amount <= max);
        }

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await products.CountAsync(ct);

        products = sort switch
        {
            ProductSort.PriceAsc => products.OrderBy(p => p.Price.Amount).ThenBy(p => p.Id),
            ProductSort.PriceDesc => products.OrderByDescending(p => p.Price.Amount).ThenBy(p => p.Id),
            ProductSort.NameDesc => products.OrderByDescending(p => p.DisplayName ?? p.Name).ThenBy(p => p.Id),
            _ => products.OrderBy(p => p.DisplayName ?? p.Name).ThenBy(p => p.Id),
        };

        var rows = await ListItems(products.Skip(page.Skip).Take(page.PageSize)).ToListAsync(ct);
        var items = rows.Select(ToListItem).ToList();

        var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)page.PageSize);
        return TypedResults.Ok(new ProductSearchResponse(items, page.Page, page.PageSize, total, totalPages, facets));
    }

    private static async Task<ProductFacets> BuildFacetsAsync(IQueryable<Product> scope, IReadOnlyList<string> filterNames, CancellationToken ct)
    {
        var attributeRows = filterNames.Count == 0
            ? []
            : await scope
                .SelectMany(p => p.Attributes)
                .Where(a => filterNames.Contains(a.Name))
                .GroupBy(a => new { a.Name, a.Value })
                .Select(g => new AttributeRow(g.Key.Name, g.Key.Value, g.Count()))
                .ToListAsync(ct);
        var attributes = filterNames
            .Select(name => new AttributeFacet(
                name,
                attributeRows.Where(r => r.Name == name)
                    .OrderBy(r => r.Value, NaturalOrder)
                    .Select(r => new AttributeValueFacet(r.Value, r.Count))
                    .ToList()))
            .Where(f => f.Values.Count > 0)
            .ToList();

        var brands = await scope
            .Where(p => p.Brand != null)
            .GroupBy(p => p.Brand!)
            .Select(g => new { Name = g.Key, Count = g.Count() })
            .OrderByDescending(b => b.Count)
            .ThenBy(b => b.Name)
            .ToListAsync(ct);

        var prices = await scope
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Min = g.Min(p => p.Price.Amount),
                Max = g.Max(p => p.Price.Amount),
                InStock = g.Count(p => p.Stock.Quantity > 0),
            })
            .FirstOrDefaultAsync(ct);

        return new ProductFacets(
            brands.Select(b => new BrandFacet(b.Name, b.Count)).ToList(),
            prices is null ? null : MoneyDto.Hryvnia(prices.Min),
            prices is null ? null : MoneyDto.Hryvnia(prices.Max),
            prices?.InStock ?? 0,
            attributes);
    }

    private static async Task<Results<Ok<ProductDetailsDto>, ProblemHttpResult>> GetProductAsync(
        string slug,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        // Фото й характеристики — окремими запитами, без декартового добутку рядків.
        var row = await db.Set<Product>()
            .AsNoTracking()
            .AsSplitQuery()
            .Where(p => p.Slug == slug && p.IsVisible)
            .Join(db.Set<Category>(), p => p.CategoryId, c => c.Id, (p, c) => new
            {
                p.Id,
                p.Slug,
                p.Sku,
                Name = p.DisplayName ?? p.Name,
                p.Brand,
                p.DescriptionHtml,
                p.Price.Amount,
                p.Price.OldAmount,
                p.Stock.Quantity,
                p.VariantGroup,
                p.SeoTitle,
                p.SeoDescription,
                Category = new CategoryRefDto(c.Id, c.Slug, c.Name),
                Images = p.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageDto(i.Url, i.Alt)).ToList(),
                Attributes = p.Attributes.OrderBy(a => a.SortOrder).Select(a => new ProductAttributeDto(a.Name, a.Value)).ToList(),
            })
            .FirstOrDefaultAsync(ct);

        if (row is null)
        {
            return Problems.NotFound("catalog.product_not_found", "Товар не знайдено", $"Товару '{slug}' немає або він прихований.");
        }

        // Варіанти — видимі товари тієї ж групи з підписом (розділ 4 ТЗ).
        var variants = row.VariantGroup is null
            ? []
            : (await db.Set<Product>()
                .AsNoTracking()
                .Where(p => p.VariantGroup == row.VariantGroup && p.IsVisible && p.VariantLabel != null)
                .Select(p => new { p.Id, p.Slug, Label = p.VariantLabel!, p.Stock.Quantity })
                .ToListAsync(ct))
                .OrderBy(v => v.Label, NaturalOrder)
                .Select(v => new ProductVariantDto(v.Slug, v.Label, v.Quantity > 0, v.Id == row.Id))
                .ToList();

        return TypedResults.Ok(new ProductDetailsDto(
            row.Id,
            row.Slug,
            row.Sku,
            row.Name,
            row.Brand,
            row.DescriptionHtml,
            MoneyDto.Hryvnia(row.Amount),
            OldPrice(row.Amount, row.OldAmount),
            row.Quantity > 0,
            row.Category,
            row.Images,
            row.Attributes,
            variants.Count > 1 ? variants : [],
            row.SeoTitle,
            row.SeoDescription));
    }

    private static async Task<Ok<List<CollectionDto>>> GetCollectionsAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var collections = await db.Set<HomeCollection>()
            .AsNoTracking()
            .Where(c => c.IsVisible)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Title)
            .ToListAsync(ct);
        var ids = collections.SelectMany(c => c.ProductIds).Distinct().ToList();
        var items = (await ListItems(db.Set<Product>().AsNoTracking().Where(p => p.IsVisible && ids.Contains(p.Id))).ToListAsync(ct))
            .ToDictionary(r => r.Id, ToListItem);

        return TypedResults.Ok(collections
            .Select(c => new CollectionDto(c.Code, c.Title, c.ProductIds.Where(items.ContainsKey).Select(id => items[id]).ToList()))
            .ToList());
    }

    private static async Task<Ok<SitemapDto>> GetSitemapAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var categories = await LoadVisibleCategoriesAsync(db, ct);
        var products = await db.Set<Product>()
            .AsNoTracking()
            .Where(p => p.IsVisible)
            .OrderBy(p => p.Slug)
            .Select(p => new SitemapEntryDto(p.Slug, p.UpdatedAt > p.Price.UpdatedAt ? p.UpdatedAt : p.Price.UpdatedAt))
            .ToListAsync(ct);
        var latest = products.Count > 0 ? products.Max(p => p.UpdatedAt) : DateTimeOffset.UnixEpoch;

        return TypedResults.Ok(new SitemapDto(categories.Select(c => new SitemapEntryDto(c.Slug, latest)).ToList(), products));
    }

    private static async Task<Results<Ok<RedirectDto>, ProblemHttpResult>> ResolveRedirectAsync(string? path, PoliValkoDbContext db, CancellationToken ct)
    {
        var from = path?.Trim();
        var redirect = string.IsNullOrEmpty(from)
            ? null
            : await db.Set<UrlRedirect>().AsNoTracking().FirstOrDefaultAsync(r => r.FromPath == from, ct);
        return redirect is null
            ? Problems.NotFound("catalog.redirect_not_found", "Перенаправлення немає")
            : TypedResults.Ok(new RedirectDto(redirect.FromPath, redirect.ToPath));
    }

    private static async Task<Ok<List<PhotoCreditDto>>> GetPhotoCreditsAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var credits = await db.Set<Product>()
            .AsNoTracking()
            .Where(p => p.IsVisible)
            .SelectMany(p => p.Images)
            .Where(i => i.Credit != null)
            .Select(i => new { Credit = i.Credit!, i.Url })
            .Distinct()
            .OrderBy(c => c.Credit)
            .ToListAsync(ct);

        return TypedResults.Ok(credits.Select(c => new PhotoCreditDto(c.Credit, c.Url)).ToList());
    }

    /// <summary>Природний порядок значень: "2 м" перед "10 м".</summary>
    private static readonly StringComparer NaturalOrder =
        StringComparer.Create(CultureInfo.GetCultureInfo("uk-UA"), CompareOptions.NumericOrdering);

    private sealed record AttributeRow(string Name, string Value, int Count);

    internal sealed record ListItemRow(
        Guid Id,
        string Slug,
        string Sku,
        string Name,
        string? Brand,
        decimal Amount,
        decimal? OldAmount,
        decimal Quantity,
        string? ImageUrl);

    internal static IQueryable<ListItemRow> ListItems(IQueryable<Product> products) =>
        products.Select(p => new ListItemRow(
            p.Id,
            p.Slug,
            p.Sku,
            p.DisplayName ?? p.Name,
            p.Brand,
            p.Price.Amount,
            p.Price.OldAmount,
            p.Stock.Quantity,
            p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()));

    internal static ProductListItemDto ToListItem(ListItemRow r) => new(
        r.Id,
        r.Slug,
        r.Sku,
        r.Name,
        r.Brand,
        MoneyDto.Hryvnia(r.Amount),
        OldPrice(r.Amount, r.OldAmount),
        r.Quantity > 0,
        r.ImageUrl);

    /// <summary>"Довжина:20 м" → {"Довжина": ["20 м"]}. null — некоректний формат.</summary>
    private static Dictionary<string, List<string>>? ParseAttributeFilters(string[]? filters)
    {
        var result = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var filter in filters ?? [])
        {
            var separator = filter.IndexOf(':', StringComparison.Ordinal);
            if (separator <= 0 || separator == filter.Length - 1)
            {
                return null;
            }

            var name = filter[..separator].Trim();
            if (!result.TryGetValue(name, out var values))
            {
                result[name] = values = [];
            }

            values.Add(filter[(separator + 1)..].Trim());
        }

        return result;
    }

    /// <summary>Перелік характеристик для фільтрів: власний або найближчого предка.</summary>
    private static IReadOnlyList<string> FilterAttributesOf(Category category, IReadOnlyDictionary<Guid, Category> byId)
    {
        for (var current = category; current is not null; current = current.ParentId is { } parent ? byId.GetValueOrDefault(parent) : null)
        {
            if (current.FilterAttributes is { Count: > 0 })
            {
                return current.FilterAttributes;
            }
        }

        return [];
    }

    // Стару ціну показуємо лише тоді, коли вона справді більша за поточну (розділ 4 ТЗ).
    internal static MoneyDto? OldPrice(decimal amount, decimal? oldAmount) =>
        oldAmount is { } old && old > amount ? MoneyDto.Hryvnia(old) : null;

    private static Task<List<Category>> LoadVisibleCategoriesAsync(PoliValkoDbContext db, CancellationToken ct) =>
        db.Set<Category>()
            .AsNoTracking()
            .Where(c => c.IsVisible)
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Name)
            .ToListAsync(ct);

    private static IEnumerable<Guid> Descendants(Guid id, ILookup<Guid?, Category> byParent) =>
        byParent[id].SelectMany(child => Descendants(child.Id, byParent).Prepend(child.Id));

    private static CategoryRefDto ToRef(Category c) => new(c.Id, c.Slug, c.Name);

    private static ProblemHttpResult CategoryNotFound(string slug) =>
        Problems.NotFound("catalog.category_not_found", "Категорію не знайдено", $"Категорії '{slug}' немає або вона прихована.");

    private static string EscapeLike(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
}
