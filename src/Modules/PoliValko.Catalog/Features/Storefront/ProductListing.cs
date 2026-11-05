using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal static class ProductListing
{
    internal sealed record ListItemRow(
        Guid Id,
        string Slug,
        string Sku,
        string Name,
        string? Brand,
        decimal Amount,
        decimal? OldAmount,
        decimal Quantity,
        string? ImageUrl,
        DateTimeOffset CreatedAt);

    public static IQueryable<ListItemRow> ListItems(IQueryable<Product> products) =>
        products.Select(p => new ListItemRow(
            p.Id,
            p.Slug,
            p.Sku,
            p.DisplayName ?? p.Name,
            p.Brand,
            p.Price.Amount,
            p.Price.OldAmount,
            p.Stock.Quantity,
            p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
            p.CreatedAt));

    public static async Task<List<ProductListItemDto>> ToListItemsAsync(
        PoliValkoDbContext db,
        IReadOnlyList<ListItemRow> rows,
        TimeProvider time,
        CancellationToken ct)
    {
        var labels = await ProductLabelSet.LoadAsync(db, rows.Select(r => r.Id).ToList(), time.GetUtcNow(), ct);
        return rows.Select(r => ToListItem(r, labels)).ToList();
    }

    public static ProductListItemDto ToListItem(ListItemRow r, ProductLabelSet labels) => new(
        r.Id,
        r.Slug,
        r.Sku,
        r.Name,
        r.Brand,
        MoneyDto.Hryvnia(r.Amount),
        OldPrice(r.Amount, r.OldAmount),
        r.Quantity > 0,
        r.ImageUrl,
        Badges(labels.For(r.Id, r.Amount, r.OldAmount, r.CreatedAt)));

    public static IReadOnlyList<ProductLabelBadgeDto> Badges(IReadOnlyList<ProductLabel> labels) =>
        labels.Select(l => new ProductLabelBadgeDto(l.Name, l.Tone)).ToList();

    public static MoneyDto? OldPrice(decimal amount, decimal? oldAmount) =>
        oldAmount is { } old && old > amount ? MoneyDto.Hryvnia(old) : null;
}
