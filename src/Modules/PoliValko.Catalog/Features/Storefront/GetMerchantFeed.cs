using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal static class GetMerchantFeed
{
    public static async Task<Ok<List<MerchantFeedItemDto>>> HandleAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var visibleProducts = await CatalogVisibility.ProductsAsync(db, ct);
        var categories = (await CategoryQueries.LoadVisibleCategoriesAsync(db, ct)).ToDictionary(c => c.Id);
        var rows = await visibleProducts
            .AsNoTracking()
            .AsSplitQuery()
            // A shopping service takes a product only with a price and a photo. A sold-out one stays in the feed,
            // marked as such, so the listing keeps its history until the product is back.
            .Where(p => p.IsVisible && p.Price.Amount > 0 && p.Images.Any())
            .OrderBy(p => p.Slug)
            .Select(p => new
            {
                p.Id,
                p.Slug,
                p.Sku,
                Name = p.DisplayName ?? p.Name,
                p.Brand,
                p.DescriptionHtml,
                p.CategoryId,
                p.Price.Amount,
                p.Price.OldAmount,
                Quantity = p.Stock.Quantity - p.Stock.ReservedQuantity,
                Images = p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).ToList(),
                Attributes = p.Attributes.OrderBy(a => a.SortOrder).Select(a => new ProductAttributeDto(a.Name, a.Value)).ToList(),
            })
            .ToListAsync(ct);

        return TypedResults.Ok(rows.Select(r => new MerchantFeedItemDto(
            r.Id,
            r.Slug,
            r.Sku,
            r.Name,
            r.Brand,
            r.DescriptionHtml,
            MoneyDto.Hryvnia(r.Amount),
            ProductListing.OldPrice(r.Amount, r.OldAmount),
            ProductListing.IsPurchasable(r.Quantity, r.Amount),
            PathTo(r.CategoryId, categories),
            r.Images,
            r.Attributes)).ToList());
    }

    /// <summary>Category names from the top department down to the product's own category.</summary>
    private static List<string> PathTo(Guid categoryId, Dictionary<Guid, Category> categories)
    {
        var path = new List<string>();
        // The depth limit only guards against a parent loop in the data.
        for (Guid? id = categoryId; id is { } current && path.Count < 16 && categories.TryGetValue(current, out var category); id = category.ParentId)
        {
            path.Insert(0, category.Name);
        }

        return path;
    }
}
