using System.Linq.Expressions;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Storefront;

internal static class ProductListing
{
    internal sealed record ListItemRow(
        Guid Id,
        Guid CategoryId,
        string Slug,
        string Sku,
        string Name,
        string? Brand,
        decimal Amount,
        decimal? OldAmount,
        decimal Quantity,
        string? ImageUrl,
        DateTimeOffset CreatedAt);

    /// <summary>
    /// «В наявності» на вітрині: є хоч одна вільна одиниця й задана ціна. Товар із ціною 0 не продається
    /// (його так само відхиляє CheckoutCalculator), тож купити його не пропонуємо.
    /// </summary>
    public static readonly Expression<Func<Product, bool>> Purchasable =
        p => (p.Stock.Quantity - p.Stock.ReservedQuantity) >= 1 && p.Price.Amount > 0;

    public static bool IsPurchasable(decimal quantity, decimal amount) => quantity >= 1 && amount > 0;

    public static IQueryable<ListItemRow> ListItems(IQueryable<Product> products) =>
        products.Select(p => new ListItemRow(
            p.Id,
            p.CategoryId,
            p.Slug,
            p.Sku,
            p.DisplayName ?? p.Name,
            p.Brand,
            p.Price.Amount,
            p.Price.OldAmount,
            (p.Stock.Quantity - p.Stock.ReservedQuantity),
            p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
            p.CreatedAt));

    /// <param name="visibleProducts">
    /// The visible catalog the caller already has (<see cref="CatalogVisibility.Products"/>): the pack sizes of a card
    /// count only visible products, and loading the tree again here would cost another round trip.
    /// </param>
    public static async Task<List<ProductListItemDto>> ToListItemsAsync(
        PoliValkoDbContext db,
        IQueryable<Product> visibleProducts,
        IReadOnlyList<ListItemRow> rows,
        TimeProvider time,
        CancellationToken ct)
    {
        var ids = rows.Select(r => r.Id).ToList();
        var labels = await ProductLabelSet.LoadAsync(db, ids, time.GetUtcNow(), ct);
        var sizes = await PackGroups.SizesAsync(visibleProducts, ids, ct);
        return rows.Select(r => ToListItem(r, labels, sizes.GetValueOrDefault(r.Id))).ToList();
    }

    public static ProductListItemDto ToListItem(ListItemRow r, ProductLabelSet labels, (int Count, decimal? PriceFrom) sizes = default) => new(
        r.Id,
        r.CategoryId,
        r.Slug,
        r.Sku,
        r.Name,
        r.Brand,
        MoneyDto.Hryvnia(r.Amount),
        OldPrice(r.Amount, r.OldAmount),
        IsPurchasable(r.Quantity, r.Amount),
        r.ImageUrl,
        Badges(labels.For(r.Id, r.Amount, r.OldAmount, r.CreatedAt)),
        sizes.Count,
        sizes.PriceFrom is { } from ? MoneyDto.Hryvnia(from) : null);

    public static IReadOnlyList<ProductLabelBadgeDto> Badges(IReadOnlyList<ProductLabel> labels) =>
        labels.Select(l => new ProductLabelBadgeDto(l.Name, l.Tone, l.Kind)).ToList();

    public static MoneyDto? OldPrice(decimal amount, decimal? oldAmount) =>
        oldAmount is { } old && old > amount ? MoneyDto.Hryvnia(old) : null;
}
