using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.Ordering.Features.Cart;

internal sealed class ServerCartStore(PoliValkoDbContext db, CheckoutCalculator calculator, IDataProtectionProvider protection, TimeProvider time, IConfiguration configuration)
{
    private const string Cookie = "pv_cart";
    private readonly IDataProtector _protector = protection.CreateProtector("PoliValko.Cart.CheckoutResult.v1");

    public string Owner(HttpContext http)
    {
        if (http.User.CustomerId() is { } customer) return $"customer:{customer}";
        return GuestOwner(http, create: true)!;
    }

    private string? GuestOwner(HttpContext http, bool create)
    {
        var token = http.Request.Cookies[Cookie];
        if (token is null || token.Length != 64 || !token.All(char.IsAsciiHexDigit))
        {
            if (!create) return null;
            token = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(32));
            http.Response.Cookies.Append(Cookie, token, new CookieOptions
            {
                HttpOnly = true, Secure = http.Request.IsHttps || configuration["Site:PublicUrl"]?.StartsWith("https://", StringComparison.OrdinalIgnoreCase) == true, SameSite = SameSiteMode.Lax,
                Path = "/", MaxAge = TimeSpan.FromDays(90), IsEssential = true,
            });
        }
        return $"guest:{Convert.ToHexStringLower(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token)))}";
    }

    public async Task LockAsync(string owner, CancellationToken ct) =>
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({owner}, 0))", ct);

    public async Task<ServerCart> LoadAsync(string owner, CancellationToken ct)
    {
        var cart = await db.Set<ServerCart>().SingleOrDefaultAsync(c => c.Owner == owner, ct);
        if (cart is not null) return cart;
        cart = new ServerCart { Owner = owner, UpdatedAt = time.GetUtcNow() };
        db.Add(cart);
        return cart;
    }

    public async Task<ServerCart> OpenAsync(HttpContext http, CancellationToken ct)
    {
        var owner = Owner(http);
        var guest = owner.StartsWith("customer:", StringComparison.Ordinal) ? GuestOwner(http, create: false) : null;
        foreach (var key in new[] { owner, guest }.OfType<string>().Distinct().Order(StringComparer.Ordinal)) await LockAsync(key, ct);
        var cart = await LoadAsync(owner, ct);
        if (guest is not null && await db.Set<ServerCart>().SingleOrDefaultAsync(c => c.Owner == guest, ct) is { } guestCart)
        {
            // Merge once. The old guest cookie never exposes the signed-in customer's cart or order token.
            var merged = Items(cart).Concat(Items(guestCart)).GroupBy(i => i.ProductId)
                .Select(g => new CartLineRequest(g.Key, Math.Min(g.Sum(i => i.Quantity), CheckoutCalculator.MaxQuantity))).ToArray();
            if (merged.Length <= CheckoutCalculator.MaxLines && Items(guestCart).Count > 0)
            {
                Replace(cart, merged);
                Replace(guestCart, []);
            }
        }
        return cart;
    }

    public static IReadOnlyList<CartLineRequest> Items(ServerCart cart) => JsonSerializer.Deserialize<List<CartLineRequest>>(cart.ItemsJson)!;

    public void Replace(ServerCart cart, IReadOnlyList<CartLineRequest> items)
    {
        cart.ItemsJson = JsonSerializer.Serialize(items);
        cart.Revision++;
        cart.UpdatedAt = time.GetUtcNow();
    }

    public void Complete(ServerCart cart, OrderCreatedDto result)
    {
        cart.CheckoutRevision = cart.Revision;
        cart.ProtectedCheckoutResult = _protector.Protect(JsonSerializer.Serialize(result));
        Replace(cart, []);
    }

    public OrderCreatedDto? LastOrder(ServerCart cart) => cart.ProtectedCheckoutResult is { } value
        ? JsonSerializer.Deserialize<OrderCreatedDto>(_protector.Unprotect(value)) : null;

    public async Task<ServerCartDto> DtoAsync(ServerCart cart, CancellationToken ct)
    {
        var (lines, _) = await calculator.PriceAsync(Items(cart), ct);
        return new(cart.Id, cart.Revision, lines.Select(CheckoutCalculator.ToDto).ToArray(), cart.CheckoutRevision + 1 == cart.Revision ? LastOrder(cart) : null);
    }
}
