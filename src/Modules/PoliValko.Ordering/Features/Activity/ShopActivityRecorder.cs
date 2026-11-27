using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.Ordering.Features.Activity;

internal static class ShopActivityRecorder
{
    private static readonly TimeSpan Retention = TimeSpan.FromDays(30);

    public static string ParseDevice(HttpRequest request)
    {
        var ua = request.Headers.UserAgent.ToString();
        if (string.IsNullOrEmpty(ua)) return "desktop";
        return ua.Contains("Mobile", StringComparison.OrdinalIgnoreCase)
            || ua.Contains("Android", StringComparison.OrdinalIgnoreCase)
            || ua.Contains("iPhone", StringComparison.OrdinalIgnoreCase)
            || ua.Contains("iPad", StringComparison.OrdinalIgnoreCase)
            || ua.Contains("iPod", StringComparison.OrdinalIgnoreCase)
            ? "mobile"
            : "desktop";
    }

    public static Guid? CustomerIdFromOwner(string owner)
    {
        if (!owner.StartsWith("customer:", StringComparison.Ordinal)) return null;
        return Guid.TryParse(owner.AsSpan("customer:".Length), out var id) ? id : null;
    }

    public static string GuestTag(string owner)
    {
        if (!owner.StartsWith("guest:", StringComparison.Ordinal)) return string.Empty;
        var hash = owner.AsSpan("guest:".Length);
        return hash.Length >= 6 ? hash[..6].ToString().ToUpperInvariant() : hash.ToString().ToUpperInvariant();
    }

    public static ShopActivityEvent Create(string kind, string owner, Guid productId, int quantity, HttpRequest request, DateTimeOffset now) =>
        new()
        {
            Id = Guid.CreateVersion7(now),
            Kind = kind,
            VisitorKey = owner,
            VisitorTag = GuestTag(owner),
            CustomerId = CustomerIdFromOwner(owner),
            ProductId = productId,
            Quantity = Math.Max(1, quantity),
            Device = ParseDevice(request),
            OccurredAt = now,
        };

    public static List<ShopActivityEvent> DiffCartEvents(
        string owner,
        IReadOnlyList<CartLineRequest> before,
        IReadOnlyList<CartLineRequest> after,
        HttpRequest request,
        DateTimeOffset now)
    {
        var prev = before.GroupBy(i => i.ProductId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
        var next = after.GroupBy(i => i.ProductId).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));
        var productIds = prev.Keys.Union(next.Keys);
        var events = new List<ShopActivityEvent>();
        var tick = 0;

        foreach (var productId in productIds)
        {
            var oldQty = prev.GetValueOrDefault(productId, 0);
            var newQty = next.GetValueOrDefault(productId, 0);
            if (newQty > oldQty)
            {
                events.Add(Create(ShopActivityKinds.CartAdd, owner, productId, newQty - oldQty, request, now.AddTicks(tick++)));
            }
            else if (newQty < oldQty)
            {
                events.Add(Create(ShopActivityKinds.CartRemove, owner, productId, oldQty - newQty, request, now.AddTicks(tick++)));
            }
        }

        return events;
    }

    public static async Task TrimExpiredOccasionallyAsync(PoliValkoDbContext db, DateTimeOffset now, CancellationToken ct)
    {
        if (Random.Shared.Next(100) != 0) return;
        var cutoff = now - Retention;
        await db.Set<ShopActivityEvent>()
            .Where(e => e.OccurredAt < cutoff)
            .ExecuteDeleteAsync(ct);
    }
}
