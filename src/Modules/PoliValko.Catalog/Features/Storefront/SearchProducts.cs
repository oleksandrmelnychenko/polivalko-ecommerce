using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal static class SearchProducts
{
    private const int MaxAttributeFilters = 20;
    private const int MaxFilterValues = 50;
    private const int MaxBrands = 50;

    public static async Task<Results<Ok<ProductSearchResponse>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        [AsParameters] ProductSearchQuery query,
        PoliValkoDbContext db,
        SeasonalMerchandising merchandising,
        ISettingsStore settings,
        TimeProvider time,
        CancellationToken ct)
    {
        var today = KyivTime.Today(time);
        var setting = query.Sort is null ? await StorefrontMode.ForListingAsync(settings, today, ct) : null;
        var sort = query.Sort ?? setting!.Mode;
        if (!ProductSort.All.Contains(sort))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["sort"] = [$"Допустимі значення: {string.Join(", ", ProductSort.All)}."],
            });
        }

        var attributeFilters = ProductFacetBuilder.ParseAttributeFilters(query.F);
        if (attributeFilters is null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["f"] = ["Фільтр характеристики має формат Назва:Значення."],
            });
        }

        if (attributeFilters.Count > MaxAttributeFilters || attributeFilters.Values.Any(values => values.Count > MaxFilterValues))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["f"] = [$"Не більше {MaxAttributeFilters} характеристик і {MaxFilterValues} значень для кожної."],
            });
        }

        var brands = (query.Brand ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
        if (brands.Count > MaxBrands)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["brand"] = [$"Не більше {MaxBrands} брендів у фільтрі."],
            });
        }

        var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
        var visibleProducts = CatalogVisibility.Products(db, categories.Select(c => c.Id).ToArray());
        var scope = visibleProducts;
        IReadOnlyList<string> filterNames = [];

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var root = categories.FirstOrDefault(c => c.Slug == query.Category);
            if (root is null)
            {
                return CategoryQueries.CategoryNotFound(query.Category);
            }

            var ids = CategoryQueries.Descendants(root.Id, categories.ToLookup(c => c.ParentId)).Append(root.Id).ToList();
            scope = scope.Where(p => ids.Contains(p.CategoryId));
            filterNames = ProductFacetBuilder.FilterAttributesOf(root, categories.ToDictionary(c => c.Id));
        }

        if (!string.IsNullOrWhiteSpace(query.BrandPage))
        {
            // Like a category, a brand page narrows the scope itself, so its facets describe the brand's products.
            var names = await BrandPages.NamesAsync(db, visibleProducts, query.BrandPage, ct);
            if (names is null)
            {
                return BrandPages.NotFound(query.BrandPage);
            }

            scope = scope.Where(p => p.Brand != null && names.Contains(p.Brand));
        }

        var approximate = false;
        IReadOnlyList<Guid[]>? relevance = null;
        Guid[]? about = null;
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            // The visible catalog is a few thousand short rows: matching them in memory lets search understand word
            // forms, synonyms, layouts and typos, while SQL keeps visibility, filters, facets and prices.
            var entries = await scope
                .Select(p => new SearchEntry(p.Id, p.Name, p.DisplayName, p.Brand, p.Slug, p.Sku, p.CategoryId))
                .ToListAsync(ct);
            var ranking = ProductSearch.Rank(query.Q, entries, categories);
            var ids = ranking.Ids.ToArray();
            approximate = ranking.Approximate;
            relevance = ranking.Better;
            about = ranking.About.ToArray();
            scope = scope.Where(p => ids.Contains(p.Id));
        }

        if (query.OnSale == true)
        {
            scope = scope.Where(p => p.Price.OldAmount != null && p.Price.OldAmount > p.Price.Amount);
        }

        var facets = await ProductFacetBuilder.BuildFacetsAsync(scope, filterNames, ct);

        var products = scope;
        if (brands.Count > 0)
        {
            products = products.Where(p => p.Brand != null && brands.Contains(p.Brand));
        }

        if (query.InStock == true)
        {
            products = products.Where(ProductListing.Purchasable);
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
            // A price of 0 means "price on request": it is not a price within any range.
            products = products.Where(p => p.Price.Amount > 0 && p.Price.Amount <= max);
        }

        products = await PackGroups.OneCardEachAsync(products, ct);

        var page = PageRequest.From(query.Page, query.PageSize);
        var total = await products.CountAsync(ct);

        products = sort switch
        {
            ProductSort.Seasonal or ProductSort.StockCover =>
                await merchandising.SortAsync(products, categories, query.Q?.Trim(), db, today, ct, sort,
                    acrossCategories: string.IsNullOrWhiteSpace(query.Category),
                    pinned: string.IsNullOrWhiteSpace(query.Q) && string.IsNullOrWhiteSpace(query.Category) ? setting?.PinnedProductIds : null,
                    relevance: relevance, about: about),
            // Products without a price go last in both directions.
            ProductSort.PriceAsc => products.OrderByDescending(p => p.Price.Amount > 0).ThenBy(p => p.Price.Amount).ThenBy(p => p.Id),
            ProductSort.PriceDesc => products.OrderByDescending(p => p.Price.Amount > 0).ThenByDescending(p => p.Price.Amount).ThenBy(p => p.Id),
            ProductSort.NameDesc => products.OrderByDescending(p => p.DisplayName ?? p.Name).ThenBy(p => p.Id),
            _ => products.OrderBy(p => p.DisplayName ?? p.Name).ThenBy(p => p.Id),
        };

        var rows = await ProductListing.ListItems(products.Skip(page.Skip).Take(page.PageSize)).ToListAsync(ct);
        var items = await ProductListing.ToListItemsAsync(db, visibleProducts, rows, time, ct);

        var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)page.PageSize);
        return TypedResults.Ok(new ProductSearchResponse(items, page.Page, page.PageSize, total, totalPages, facets, approximate && total > 0));
    }
}
