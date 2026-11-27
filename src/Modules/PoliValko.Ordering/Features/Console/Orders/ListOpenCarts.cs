using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Features.Activity;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;
using System.Text.Json;

namespace PoliValko.Ordering.Features.Console.Orders;

public sealed record ConsoleOpenCart(
    Guid Id,
    bool IsGuest,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<QuoteLineDto> Items,
    MoneyDto Subtotal,
    string VisitorTag = "",
    Guid? CustomerId = null,
    string? CustomerName = null,
    string? CustomerPhone = null,
    string? CustomerEmail = null);

internal static class ListOpenCarts
{
    internal sealed record StoredCart(Guid Id, string Owner, bool IsGuest, DateTimeOffset UpdatedAt, string ItemsJson);

    public static async Task<PagedResponse<ConsoleOpenCart>> HandleAsync(
        int? page, HttpResponse response, PoliValkoDbContext db, ICatalogPricing pricing, ICustomerDirectory customers, CancellationToken ct)
    {
        response.Headers.CacheControl = "private, no-store";
        var paging = PageRequest.From(page, 20);
        var open = db.Database.SqlQuery<StoredCart>($"""
            SELECT id, owner, owner LIKE 'guest:%' AS is_guest, updated_at, items_json::text AS items_json
            FROM ordering.carts WHERE jsonb_array_length(items_json) > 0
            """);
        var total = await open.CountAsync(ct);
        var rows = await open.OrderByDescending(c => c.UpdatedAt).ThenBy(c => c.Id)
            .Skip(paging.Skip).Take(paging.PageSize).ToListAsync(ct);
        var carts = rows.Select(row => (row, items: JsonSerializer.Deserialize<List<CartLineRequest>>(row.ItemsJson)!)).ToList();
        if (carts.Count == 0) return PagedResponse<ConsoleOpenCart>.Create([], paging, total);
        var ids = carts.SelectMany(c => c.items).Select(i => i.ProductId).Distinct().ToArray();
        var products = await pricing.GetAsync(ids, ct);
        var customerIds = carts
            .Select(c => ShopActivityRecorder.CustomerIdFromOwner(c.row.Owner))
            .OfType<Guid>()
            .Distinct()
            .ToArray();
        var briefs = customerIds.Length > 0
            ? await customers.GetBriefsAsync(customerIds, ct)
            : new Dictionary<Guid, CustomerBrief>();
        var result = carts.Select(c =>
        {
            var (lines, subtotal) = CheckoutCalculator.Price(c.items, products);
            var customerId = ShopActivityRecorder.CustomerIdFromOwner(c.row.Owner);
            CustomerBrief? brief = customerId.HasValue && briefs.TryGetValue(customerId.Value, out var found) ? found : null;
            return new ConsoleOpenCart(
                c.row.Id,
                c.row.IsGuest,
                c.row.UpdatedAt,
                lines.Select(CheckoutCalculator.ToDto).ToArray(),
                MoneyDto.Hryvnia(subtotal),
                ShopActivityRecorder.GuestTag(c.row.Owner),
                customerId,
                brief?.Name,
                brief?.Phone,
                brief?.Email);
        }).ToList();
        return PagedResponse<ConsoleOpenCart>.Create(result, paging, total);
    }
}
