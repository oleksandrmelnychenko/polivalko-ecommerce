using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Admin.Products;

internal static class AdminProductQueries
{
    public static Task<Product?> LoadProductAsync(PoliValkoDbContext db, Guid id, bool tracking, CancellationToken ct)
    {
        var query = db.Set<Product>()
            .Include(p => p.Price)
            .Include(p => p.Stock)
            .Include(p => p.Images)
            .Include(p => p.Attributes)
            .AsSplitQuery();
        return (tracking ? query : query.AsNoTracking()).FirstOrDefaultAsync(p => p.Id == id, ct);
    }

    public static async Task<List<AdminProductListItemDto>> ProjectListItemsAsync(PoliValkoDbContext db, IQueryable<Product> products, CancellationToken ct)
    {
        var rows = await products
            .Join(db.Set<Category>(), p => p.CategoryId, c => c.Id, (p, c) => new ListRow(
                p.Id,
                p.Sku,
                p.Name,
                p.DisplayName,
                p.Slug,
                c.Name,
                p.Price.Amount,
                p.Stock.Quantity,
                p.IsVisible,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.DescriptionHtml != null,
                p.UpdatedAt))
            .ToListAsync(ct);
        return rows.Select(r => r.ToDto()).ToList();
    }

    public static async Task<Dictionary<Guid, AdminProductListItemDto>> LoadListItemsAsync(PoliValkoDbContext db, IEnumerable<Guid> ids, CancellationToken ct)
    {
        var list = ids.Distinct().ToList();
        if (list.Count == 0)
        {
            return [];
        }

        var rows = await ProjectListItemsAsync(db, db.Set<Product>().AsNoTracking().Where(p => list.Contains(p.Id)), ct);
        return rows.ToDictionary(r => r.Id);
    }

    public static AdminProductDto ToDto(Product p) => new(
        p.Id,
        new NavkoloProductFieldsDto(
            p.NavkoloId,
            p.Sku,
            p.Name,
            p.NavkoloGroupRef,
            MoneyDto.Hryvnia(p.Price.Amount),
            p.Price.OldAmount is { } old ? MoneyDto.Hryvnia(old) : null,
            p.Stock.Quantity,
            p.Price.UpdatedAt,
            p.Stock.UpdatedAt,
            p.VariantGroup,
            p.VariantLabel),
        p.DisplayName,
        p.Slug,
        p.CategoryId,
        p.Brand,
        p.DescriptionHtml,
        p.IsVisible,
        p.SeoTitle,
        p.SeoDescription,
        p.Attributes.OrderBy(a => a.SortOrder).Select(a => new ProductAttributeDto(a.Name, a.Value)).ToList(),
        p.Images.OrderBy(i => i.SortOrder).Select(i => new AdminProductImageDto(i.Id, i.Url, i.Alt, i.SortOrder, i.Credit)).ToList(),
        p.UpdatedAt);

    public static string[] ProductTags(params string[] slugs) =>
        [StorefrontTags.Products, StorefrontTags.Collections, .. slugs.Distinct().Select(StorefrontTags.Product)];

    public static ProblemHttpResult ProductNotFound() => Problems.NotFound("catalog.product_not_found", "Товар не знайдено");

    private sealed record ListRow(
        Guid Id,
        string Sku,
        string Name,
        string? DisplayName,
        string Slug,
        string CategoryName,
        decimal Price,
        decimal Stock,
        bool IsVisible,
        string? ImageUrl,
        bool HasDescription,
        DateTimeOffset UpdatedAt)
    {
        public AdminProductListItemDto ToDto() =>
            new(Id, Sku, Name, DisplayName, Slug, CategoryName, MoneyDto.Hryvnia(Price), Stock, IsVisible, ImageUrl, HasDescription, UpdatedAt);
    }
}
