using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class ConsoleProductQueries
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

    public static async Task<List<ConsoleProductListItemDto>> ProjectListItemsAsync(PoliValkoDbContext db, IQueryable<Product> products, DateTimeOffset now, CancellationToken ct)
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
                p.Price.OldAmount,
                p.Stock.Quantity,
                p.Stock.ReservedQuantity,
                p.Stock.WarehouseOrgId,
                p.Stock.WarehouseStoreId,
                p.IsVisible,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.DescriptionHtml != null && !ProductFillFilters.EmptyDescriptions.Contains(p.DescriptionHtml.Trim()),
                p.UpdatedAt,
                p.CreatedAt))
            .ToListAsync(ct);
        var labels = await ProductLabelSet.LoadAsync(db, rows.Select(r => r.Id).ToList(), now, ct);
        var storeTitles = await LoadStoreTitlesAsync(db, rows.Select(r => r.WarehouseStoreId), ct);
        return rows.Select(r => r.ToDto(
            Labels(labels.For(r.Id, r.Price, r.OldPrice, r.CreatedAt)),
            r.WarehouseStoreId is { } storeId ? storeTitles.GetValueOrDefault(storeId) : null)).ToList();
    }

    public static async Task<Dictionary<Guid, ConsoleProductListItemDto>> LoadListItemsAsync(PoliValkoDbContext db, IEnumerable<Guid> ids, DateTimeOffset now, CancellationToken ct)
    {
        var list = ids.Distinct().ToList();
        if (list.Count == 0)
        {
            return [];
        }

        var rows = await ProjectListItemsAsync(db, db.Set<Product>().AsNoTracking().Where(p => list.Contains(p.Id)), now, ct);
        return rows.ToDictionary(r => r.Id);
    }

    public static async Task<ConsoleProductDto> ToDtoAsync(PoliValkoDbContext db, Product p, DateTimeOffset now, CancellationToken ct)
    {
        var linked = await db.Set<ProductLabelLink>().AsNoTracking()
            .Where(l => l.ProductId == p.Id)
            .Join(db.Set<ProductLabel>(), l => l.LabelId, l => l.Id, (_, label) => label)
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.Name)
            .Select(l => l.Id)
            .ToListAsync(ct);
        var labels = await ProductLabelSet.LoadAsync(db, [p.Id], now, ct);
        var storeTitles = await LoadStoreTitlesAsync(db, [p.Stock.WarehouseStoreId], ct);
        var storeTitle = p.Stock.WarehouseStoreId is { } storeId ? storeTitles.GetValueOrDefault(storeId) : null;
        return ToDto(p, linked, Labels(labels.For(p.Id, p.Price.Amount, p.Price.OldAmount, p.CreatedAt)), storeTitle);
    }

    public static IReadOnlyList<ConsoleProductLabelDto> Labels(IReadOnlyList<ProductLabel> labels) =>
        labels.Select(l => new ConsoleProductLabelDto(l.Id, l.Name, l.Tone, l.Kind)).ToList();

    public static readonly string[] ProductTags = [StorefrontTags.Products, StorefrontTags.Collections];

    public static ProblemHttpResult ProductNotFound() => Problems.NotFound("catalog.product_not_found", "Товар не знайдено");

    private static async Task<Dictionary<Guid, string>> LoadStoreTitlesAsync(PoliValkoDbContext db, IEnumerable<Guid?> storeIds, CancellationToken ct)
    {
        var ids = storeIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToArray();
        if (ids.Length == 0)
        {
            return [];
        }

        var rows = await db.Database.SqlQuery<StoreTitleRow>($"""
            SELECT id, title
            FROM accounting.references
            WHERE kind = 'store' AND id = ANY({ids})
            """).ToListAsync(ct);
        return rows.ToDictionary(r => r.Id, r => r.Title);
    }

    private static ConsoleProductDto ToDto(Product p, IReadOnlyList<Guid> labelIds, IReadOnlyList<ConsoleProductLabelDto> labels, string? warehouseStoreTitle) => new(
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
        p.Images.OrderBy(i => i.SortOrder).Select(i => new ConsoleProductImageDto(i.Id, i.Url, i.Alt, i.SortOrder, i.Credit)).ToList(),
        p.UpdatedAt,
        labelIds,
        labels,
        p.CreatedAt,
        p.IsArchived,
        p.Stock.ReservedQuantity,
        Math.Max(0m, p.Stock.Quantity - p.Stock.ReservedQuantity),
        p.Stock.WarehouseOrgId,
        p.Stock.WarehouseStoreId,
        warehouseStoreTitle);

    private sealed record StoreTitleRow(Guid Id, string Title);

    private sealed record ListRow(
        Guid Id,
        string Sku,
        string Name,
        string? DisplayName,
        string Slug,
        string CategoryName,
        decimal Price,
        decimal? OldPrice,
        decimal Stock,
        decimal ReservedQuantity,
        Guid? WarehouseOrgId,
        Guid? WarehouseStoreId,
        bool IsVisible,
        string? ImageUrl,
        bool HasDescription,
        DateTimeOffset UpdatedAt,
        DateTimeOffset CreatedAt)
    {
        public ConsoleProductListItemDto ToDto(IReadOnlyList<ConsoleProductLabelDto> labels, string? warehouseStoreTitle) =>
            new(Id, Sku, Name, DisplayName, Slug, CategoryName, MoneyDto.Hryvnia(Price), Stock, IsVisible, ImageUrl, HasDescription, UpdatedAt, labels,
                ReservedQuantity, Math.Max(0m, Stock - ReservedQuantity), WarehouseOrgId, WarehouseStoreId, warehouseStoreTitle);
    }
}
