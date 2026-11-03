using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Import;

internal static class ProductFieldWriter
{
    public static bool FillSiteFields(Product product, NavkoloProductRecord record, DateTimeOffset now)
    {
        var changed = false;
        if (product.Attributes.Count == 0 && record.Attributes is { Count: > 0 } attributes)
        {
            var order = 0;
            foreach (var a in attributes.Where(a => !string.IsNullOrWhiteSpace(a.Name) && !string.IsNullOrWhiteSpace(a.Value)).Take(50))
            {
                product.Attributes.Add(new ProductAttribute
                {
                    Id = Guid.CreateVersion7(now),
                    ProductId = product.Id,
                    Name = Clip(a.Name, 100)!,
                    Value = Clip(a.Value, 300)!,
                    SortOrder = order++,
                });
            }

            changed = order > 0;
        }

        if (product.Images.Count == 0 && record.ImageUrls is { Count: > 0 } urls)
        {
            var order = 0;
            foreach (var url in urls.Where(u => Uri.TryCreate(u, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https").Take(20))
            {
                product.Images.Add(new ProductImage
                {
                    Id = Guid.CreateVersion7(now),
                    ProductId = product.Id,
                    Url = url,
                    Alt = product.Name,
                    SortOrder = order++,
                });
            }

            changed |= order > 0;
        }

        return changed;
    }

    public static bool SetPrice(Product product, decimal amount, decimal? oldAmount, DateTimeOffset now)
    {
        if (product.Price.Amount == amount && product.Price.OldAmount == oldAmount)
        {
            return false;
        }

        product.Price.Amount = amount;
        product.Price.OldAmount = oldAmount;
        product.Price.UpdatedAt = now;
        return true;
    }

    public static bool SetStock(Product product, decimal quantity, DateTimeOffset now)
    {
        if (product.Stock.Quantity == quantity)
        {
            return false;
        }

        product.Stock.Quantity = quantity;
        product.Stock.UpdatedAt = now;
        return true;
    }

    public static bool Set(string? current, string? value, Action<string> apply)
    {
        if (value is null || current == value)
        {
            return false;
        }

        apply(value);
        return true;
    }

    public static string UniqueSlug(NavkoloProductRecord record, HashSet<string> taken)
    {
        var baseSlug = $"{Transliteration.ToSlug(record.Name!)}-{Transliteration.ToSlug(record.Sku!)}".Trim('-');
        if (baseSlug.Length > 280)
        {
            baseSlug = baseSlug[..280].TrimEnd('-');
        }

        var slug = baseSlug;
        for (var n = 2; !taken.Add(slug); n++)
        {
            slug = $"{baseSlug}-{n}";
        }

        return slug;
    }

    public static string? Clip(string? value, int max) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim() is var v && v.Length > max ? v[..max] : value.Trim();
}
