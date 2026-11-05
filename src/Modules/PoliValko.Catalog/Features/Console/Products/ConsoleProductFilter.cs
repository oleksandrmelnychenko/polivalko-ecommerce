using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class ConsoleProductFilter
{
    public static IQueryable<Product> NeedsFilling(this IQueryable<Product> products) =>
        products.Where(p => !p.Images.Any() || p.DescriptionHtml == null || p.DescriptionHtml == string.Empty || !p.Attributes.Any());

    public static IQueryable<Product> CreatedSince(this IQueryable<Product> products, DateTimeOffset now, int days)
    {
        var since = now.AddDays(-days);
        return products.Where(p => p.CreatedAt >= since);
    }

    public static IQueryable<Product> HiddenWithStock(this IQueryable<Product> products) =>
        products.Where(p => !p.IsVisible && p.Stock.Quantity > 0);

    public static IQueryable<Product> WithBrand(this IQueryable<Product> products, string brand)
    {
        var normalized = Brand.Normalize(brand);
        return products.Where(p => p.Brand != null && p.Brand.Trim().ToUpper() == normalized);
    }

    public static IQueryable<Product> WithLabel(this IQueryable<Product> products, PoliValkoDbContext db, ProductLabel label, DateTimeOffset now) => label.Kind switch
    {
        LabelKind.Sale => products.Where(p => p.Price.OldAmount != null && p.Price.OldAmount > p.Price.Amount),
        LabelKind.New => products.CreatedSince(now, label.NewDays ?? 0),
        _ => products.Where(p => db.Set<ProductLabelLink>().Any(l => l.ProductId == p.Id && l.LabelId == label.Id)),
    };

    public static IQueryable<Product>? WithFill(this IQueryable<Product> products, string? fill) => fill?.Trim().ToLowerInvariant() switch
    {
        null or "" => products,
        ProductFillFilters.MissingPhoto => products.Where(p => !p.Images.Any()),
        ProductFillFilters.MissingDescription => products.Where(p => p.DescriptionHtml == null || p.DescriptionHtml == string.Empty),
        ProductFillFilters.MissingAttributes => products.Where(p => !p.Attributes.Any()),
        ProductFillFilters.AnyMissing => products.NeedsFilling(),
        _ => null,
    };
}
