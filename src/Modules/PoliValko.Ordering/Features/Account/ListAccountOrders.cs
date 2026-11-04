using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Account;

internal static class ListAccountOrders
{
    public static async Task<Ok<PagedResponse<AccountOrderListItemDto>>> HandleAsync(
        int? page,
        int? pageSize,
        HttpContext http,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var customerId = http.User.CustomerId();
        var request = PageRequest.From(page, pageSize);
        var orders = db.Set<Order>().AsNoTracking().Where(o => o.CustomerId == customerId);
        var total = await orders.CountAsync(ct);
        var rows = await orders
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Number)
            .Skip(request.Skip)
            .Take(request.PageSize)
            .Select(o => new
            {
                o.Number,
                o.CreatedAt,
                o.Status,
                o.PaymentMethod,
                o.PaymentStatus,
                o.DeliveryMethod,
                o.Total,
                ItemCount = o.Items.Count,
                Main = o.Items
                    .OrderByDescending(i => i.LineTotal)
                    .ThenBy(i => i.Name)
                    .Select(i => new { i.Name, i.ImageUrl })
                    .FirstOrDefault(),
            })
            .ToListAsync(ct);

        var items = rows
            .Select(r => new AccountOrderListItemDto(
                r.Number,
                r.CreatedAt,
                r.Status,
                PaymentCodes.From(r.PaymentMethod),
                r.PaymentStatus,
                DeliveryCodes.From(r.DeliveryMethod),
                MoneyDto.Hryvnia(r.Total),
                r.ItemCount,
                r.Main?.Name ?? string.Empty,
                r.Main?.ImageUrl,
                OrderMapping.CanPay(r.PaymentMethod, r.Status, r.PaymentStatus)))
            .ToList();
        return TypedResults.Ok(PagedResponse<AccountOrderListItemDto>.Create(items, request, total));
    }
}
