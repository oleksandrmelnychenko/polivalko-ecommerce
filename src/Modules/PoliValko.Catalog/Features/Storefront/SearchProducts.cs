using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal static class SearchProducts
{
    public static async Task<Results<Ok<ProductSearchResponse>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        [AsParameters] ProductSearchQuery query,
        PoliValkoDbContext db,
        TimeProvider time,
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

        var attributeFilters = ProductFacetBuilder.ParseAttributeFilters(query.F);
        if (attributeFilters is null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["f"] = ["Фільтр характеристики має формат Назва:Значення."],
            });
        }

        var scope = db.Set<Product>().AsNoTracking().Where(p => p.IsVisible);
        IReadOnlyList<string> filterNames = [];

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
            var root = categories.FirstOrDefault(c => c.Slug == query.Category);
            if (root is null)
            {
                return CategoryQueries.CategoryNotFound(query.Category);
            }

            var ids = CategoryQueries.Descendants(root.Id, categories.ToLookup(c => c.ParentId)).Append(root.Id).ToList();
            scope = scope.Where(p => ids.Contains(p.CategoryId));
            filterNames = ProductFacetBuilder.FilterAttributesOf(root, categories.ToDictionary(c => c.Id));
        }

        var approximate = false;
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            var term = query.Q.Trim();
            var words = ProductSearchText.Words(term);
            var matching = ProductSearchText.Matching(scope, term, words);
            var similar = await matching.AnyAsync(ct) ? null : ProductSearchText.Similar(scope, db.Set<Product>(), words);
            approximate = similar is not null;
            scope = similar ?? matching;
        }

        if (query.OnSale == true)
        {
            scope = scope.Where(p => p.Price.OldAmount != null && p.Price.OldAmount > p.Price.Amount);
        }

        var facets = await ProductFacetBuilder.BuildFacetsAsync(scope, filterNames, ct);

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

        var rows = await ProductListing.ListItems(products.Skip(page.Skip).Take(page.PageSize)).ToListAsync(ct);
        var items = await ProductListing.ToListItemsAsync(db, rows, time, ct);

        var totalPages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)page.PageSize);
        return TypedResults.Ok(new ProductSearchResponse(items, page.Page, page.PageSize, total, totalPages, facets, approximate && total > 0));
    }
}
