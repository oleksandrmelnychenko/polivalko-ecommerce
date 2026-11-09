using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal static class GetProduct
{
    public static async Task<Results<Ok<ProductDetailsDto>, ProblemHttpResult>> HandleAsync(
        string slug,
        PoliValkoDbContext db,
        ISettingsStore settings,
        TimeProvider time,
        CancellationToken ct)
    {
        var visibleProducts = await CatalogVisibility.ProductsAsync(db, ct);
        var row = await visibleProducts
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
                Quantity = (p.Stock.Quantity - p.Stock.ReservedQuantity),
                p.VariantGroup,
                p.SeoTitle,
                p.SeoDescription,
                p.CreatedAt,
                Category = new CategoryRefDto(c.Id, c.Slug, c.Name),
                Images = p.Images.OrderBy(i => i.SortOrder).Select(i => new ProductImageDto(i.Url, i.Alt)).ToList(),
                Attributes = p.Attributes.OrderBy(a => a.SortOrder).Select(a => new ProductAttributeDto(a.Name, a.Value)).ToList(),
            })
            .FirstOrDefaultAsync(ct);

        if (row is null)
        {
            return Problems.NotFound("catalog.product_not_found", "Товар не знайдено", $"Товару '{slug}' немає або він прихований.");
        }

        var variants = row.VariantGroup is null
            ? []
            : (await visibleProducts
                .AsNoTracking()
                .Where(p => p.VariantGroup == row.VariantGroup && p.IsVisible && p.VariantLabel != null)
                .Select(p => new { p.Id, p.Slug, Label = p.VariantLabel!, Quantity = (p.Stock.Quantity - p.Stock.ReservedQuantity) })
                .ToListAsync(ct))
                .OrderBy(v => v.Label, CategoryQueries.NaturalOrder)
                .Select(v => new ProductVariantDto(v.Slug, v.Label, v.Quantity > 0, v.Id == row.Id))
                .ToList();

        var labels = await ProductLabelSet.LoadAsync(db, [row.Id], time.GetUtcNow(), ct);
        var templates = await SeoTemplates.LoadAsync(settings, ct);
        var (seoTitle, seoDescription) = SeoTemplates.Fill(
            templates.Product,
            row.SeoTitle,
            row.SeoDescription,
            new SeoTemplates.Values(row.Name, SeoTemplates.Price(row.Amount), row.Category.Name, row.Brand));

        return TypedResults.Ok(new ProductDetailsDto(
            row.Id,
            row.Slug,
            row.Sku,
            row.Name,
            row.Brand,
            row.DescriptionHtml,
            MoneyDto.Hryvnia(row.Amount),
            ProductListing.OldPrice(row.Amount, row.OldAmount),
            row.Quantity > 0,
            row.Category,
            row.Images,
            row.Attributes,
            variants.Count > 1 ? variants : [],
            seoTitle,
            seoDescription,
            ProductListing.Badges(labels.For(row.Id, row.Amount, row.OldAmount, row.CreatedAt))));
    }
}
