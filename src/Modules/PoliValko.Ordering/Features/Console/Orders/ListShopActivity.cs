using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Console.Orders;

public sealed record ConsoleShopActivitySummary(
    int CartAdds24h,
    int CompareAdds24h,
    int FavoriteAdds24h,
    int ActiveVisitors15m,
    int OpenCartsCount,
    MoneyDto OpenCartsSubtotal);

public sealed record ConsoleShopActivityTopProduct(
    Guid ProductId,
    string Sku,
    string Name,
    string Slug,
    string? ImageUrl,
    MoneyDto Price,
    int CartAdds,
    int CompareAdds,
    int FavoriteAdds,
    int TotalScore);

public sealed record ConsoleShopActivityItem(
    Guid Id,
    string Kind,
    int Quantity,
    DateTimeOffset OccurredAt,
    string Device,
    bool IsGuest,
    string VisitorTag,
    Guid? CustomerId,
    string? CustomerName,
    string? CustomerPhone,
    string? CustomerEmail,
    Guid ProductId,
    string ProductSku,
    string ProductName,
    string ProductSlug,
    string? ProductImageUrl,
    MoneyDto ProductPrice);

public sealed record ConsoleShopActivityResponse(
    ConsoleShopActivitySummary Summary,
    IReadOnlyList<ConsoleShopActivityTopProduct> TopProducts,
    PagedResponse<ConsoleShopActivityItem> Events);

internal static class ListShopActivity
{
    private const int SearchScanLimit = 500;
    private const int TopProductsCount = 8;

    private sealed record OpenCartRow(string ItemsJson);

    public static async Task<ConsoleShopActivityResponse> HandleAsync(
        string? kind,
        string? search,
        int? page,
        int? pageSize,
        HttpResponse response,
        PoliValkoDbContext db,
        ICatalogPricing pricing,
        ICustomerDirectory customers,
        TimeProvider time,
        CancellationToken ct)
    {
        response.Headers.CacheControl = "private, no-store";
        var now = time.GetUtcNow();
        var since24h = now.AddHours(-24);
        var since15m = now.AddMinutes(-15);
        var since7d = now.AddDays(-7);
        var paging = PageRequest.From(page, Math.Clamp(pageSize ?? 30, 10, 100));

        // 1. Summary counters (last 24h & active 15m)
        var recentCounts = await db.Set<ShopActivityEvent>()
            .AsNoTracking()
            .Where(e => e.OccurredAt >= since24h)
            .GroupBy(e => e.Kind)
            .Select(g => new { Kind = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var cartAdds24h = recentCounts.FirstOrDefault(x => x.Kind == ShopActivityKinds.CartAdd)?.Count ?? 0;
        var compareAdds24h = recentCounts.FirstOrDefault(x => x.Kind == ShopActivityKinds.CompareAdd)?.Count ?? 0;
        var favoriteAdds24h = recentCounts.FirstOrDefault(x => x.Kind == ShopActivityKinds.FavoriteAdd)?.Count ?? 0;

        var activeVisitors15m = await db.Set<ShopActivityEvent>()
            .AsNoTracking()
            .Where(e => e.OccurredAt >= since15m)
            .Select(e => e.VisitorKey)
            .Distinct()
            .CountAsync(ct);

        // 2. Open carts summary
        var openCartRows = await db.Database.SqlQuery<OpenCartRow>($"""
            SELECT items_json::text AS items_json
            FROM ordering.carts WHERE jsonb_array_length(items_json) > 0
            """).ToListAsync(ct);
        var openCartLines = openCartRows
            .Select(r => JsonSerializer.Deserialize<List<CartLineRequest>>(r.ItemsJson) ?? [])
            .Where(lines => lines.Count > 0)
            .ToList();

        // 3. Top products by interest over last 7 days
        var topRaw = await db.Set<ShopActivityEvent>()
            .AsNoTracking()
            .Where(e => e.OccurredAt >= since7d
                && (e.Kind == ShopActivityKinds.CartAdd
                    || e.Kind == ShopActivityKinds.CompareAdd
                    || e.Kind == ShopActivityKinds.FavoriteAdd))
            .GroupBy(e => e.ProductId)
            .Select(g => new
            {
                ProductId = g.Key,
                CartAdds = g.Count(e => e.Kind == ShopActivityKinds.CartAdd),
                CompareAdds = g.Count(e => e.Kind == ShopActivityKinds.CompareAdd),
                FavoriteAdds = g.Count(e => e.Kind == ShopActivityKinds.FavoriteAdd),
            })
            .OrderByDescending(x => x.CartAdds * 3 + x.CompareAdds * 2 + x.FavoriteAdds)
            .ThenByDescending(x => x.CartAdds)
            .Take(TopProductsCount)
            .ToListAsync(ct);

        // 4. Filtered event feed query
        var query = db.Set<ShopActivityEvent>().AsNoTracking();
        query = kind?.Trim().ToLowerInvariant() switch
        {
            "cart" => query.Where(e => e.Kind == ShopActivityKinds.CartAdd || e.Kind == ShopActivityKinds.CartRemove),
            "compare" => query.Where(e => e.Kind == ShopActivityKinds.CompareAdd || e.Kind == ShopActivityKinds.CompareRemove),
            "favorite" => query.Where(e => e.Kind == ShopActivityKinds.FavoriteAdd || e.Kind == ShopActivityKinds.FavoriteRemove),
            _ => query,
        };

        var needle = search?.Trim();
        List<ShopActivityEvent> candidateEvents;
        int totalEvents;
        if (string.IsNullOrEmpty(needle))
        {
            totalEvents = await query.CountAsync(ct);
            candidateEvents = await query
                .OrderByDescending(e => e.OccurredAt)
                .ThenByDescending(e => e.Id)
                .Skip(paging.Skip)
                .Take(paging.PageSize)
                .ToListAsync(ct);
        }
        else
        {
            candidateEvents = await query
                .OrderByDescending(e => e.OccurredAt)
                .ThenByDescending(e => e.Id)
                .Take(SearchScanLimit)
                .ToListAsync(ct);
            totalEvents = candidateEvents.Count;
        }

        // 5. Bulk hydrate products & customers once across open carts, top products, and event feed
        var productIds = candidateEvents.Select(e => e.ProductId)
            .Concat(topRaw.Select(t => t.ProductId))
            .Concat(openCartLines.SelectMany(l => l.Select(x => x.ProductId)))
            .Distinct()
            .ToArray();
        var products = productIds.Length > 0
            ? await pricing.GetAsync(productIds, ct)
            : new Dictionary<Guid, ProductPricing>();

        var customerIds = candidateEvents
            .Where(e => e.CustomerId.HasValue)
            .Select(e => e.CustomerId!.Value)
            .Distinct()
            .ToArray();
        var briefs = customerIds.Length > 0
            ? await customers.GetBriefsAsync(customerIds, ct)
            : new Dictionary<Guid, CustomerBrief>();

        decimal openCartsSubtotal = 0m;
        foreach (var cart in openCartLines)
        {
            var (_, subtotal) = CheckoutCalculator.Price(cart, products);
            openCartsSubtotal += subtotal;
        }

        var summary = new ConsoleShopActivitySummary(
            cartAdds24h,
            compareAdds24h,
            favoriteAdds24h,
            activeVisitors15m,
            openCartLines.Count,
            MoneyDto.Hryvnia(openCartsSubtotal));

        var topProducts = topRaw
            .Select(t =>
            {
                products.TryGetValue(t.ProductId, out var p);
                return new ConsoleShopActivityTopProduct(
                    t.ProductId,
                    p?.Sku ?? string.Empty,
                    p?.Name ?? "Товар видалено",
                    p?.Slug ?? string.Empty,
                    p?.ImageUrl,
                    MoneyDto.Hryvnia(p?.Price ?? 0m),
                    t.CartAdds,
                    t.CompareAdds,
                    t.FavoriteAdds,
                    t.CartAdds * 3 + t.CompareAdds * 2 + t.FavoriteAdds);
            })
            .ToList();

        var mapped = candidateEvents.Select(e =>
        {
            products.TryGetValue(e.ProductId, out var p);
            CustomerBrief? c = e.CustomerId.HasValue && briefs.TryGetValue(e.CustomerId.Value, out var found) ? found : null;
            return new ConsoleShopActivityItem(
                e.Id,
                e.Kind,
                e.Quantity,
                e.OccurredAt,
                e.Device,
                !e.CustomerId.HasValue,
                e.VisitorTag,
                e.CustomerId,
                c?.Name,
                c?.Phone,
                c?.Email,
                e.ProductId,
                p?.Sku ?? string.Empty,
                p?.Name ?? "Товар видалено",
                p?.Slug ?? string.Empty,
                p?.ImageUrl,
                MoneyDto.Hryvnia(p?.Price ?? 0m));
        }).ToList();

        if (!string.IsNullOrEmpty(needle))
        {
            var filtered = mapped.Where(item =>
                item.ProductName.Contains(needle, StringComparison.OrdinalIgnoreCase)
                || item.ProductSku.Contains(needle, StringComparison.OrdinalIgnoreCase)
                || item.VisitorTag.Contains(needle, StringComparison.OrdinalIgnoreCase)
                || (item.CustomerName?.Contains(needle, StringComparison.OrdinalIgnoreCase) == true)
                || (item.CustomerPhone?.Contains(needle, StringComparison.OrdinalIgnoreCase) == true)
                || (item.CustomerEmail?.Contains(needle, StringComparison.OrdinalIgnoreCase) == true))
                .ToList();
            totalEvents = filtered.Count;
            mapped = filtered.Skip(paging.Skip).Take(paging.PageSize).ToList();
        }

        return new ConsoleShopActivityResponse(
            summary,
            topProducts,
            PagedResponse<ConsoleShopActivityItem>.Create(mapped, paging, totalEvents));
    }
}
