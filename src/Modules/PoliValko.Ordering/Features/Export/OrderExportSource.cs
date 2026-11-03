using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Export;

internal sealed class OrderExportSource(PoliValkoDbContext db) : IOrderExportSource
{
    public async Task<OrderForExport> GetAsync(Guid orderId, CancellationToken ct)
    {
        var order = await db.Set<Order>().Include(o => o.Items).SingleAsync(o => o.Id == orderId, ct);
        return new OrderForExport(
            order.Id,
            order.Number,
            order.CreatedAt,
            order.CustomerName,
            order.CustomerPhone,
            order.DeliveryMethod,
            order.SettlementName,
            order.WarehouseName,
            order.DeliveryAddress,
            order.PickupAddress,
            order.PaymentMethod,
            order.Total,
            order.Comment,
            order.NavkoloOrderRef,
            order.Items.Select(i => new OrderForExportLine(i.Sku, i.Name, i.Quantity, i.UnitPrice)).ToList());
    }

    public async Task MarkExportedAsync(Guid orderId, string reference, DateTimeOffset at, CancellationToken ct)
    {
        var order = (await db.Set<Order>().FindAsync([orderId], ct))!;
        order.MarkExported(reference, at);
    }
}
