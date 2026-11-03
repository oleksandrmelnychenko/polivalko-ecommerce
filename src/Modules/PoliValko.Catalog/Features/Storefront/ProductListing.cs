using PoliValko.Catalog.Domain;
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
        string? ImageUrl);

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
            p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()));

    public static ProductListItemDto ToListItem(ListItemRow r) => new(
        r.Id,
        r.Slug,
        r.Sku,
        r.Name,
        r.Brand,
        MoneyDto.Hryvnia(r.Amount),
        OldPrice(r.Amount, r.OldAmount),
        r.Quantity > 0,
        r.ImageUrl);

    public static MoneyDto? OldPrice(decimal amount, decimal? oldAmount) =>
        oldAmount is { } old && old > amount ? MoneyDto.Hryvnia(old) : null;
}
