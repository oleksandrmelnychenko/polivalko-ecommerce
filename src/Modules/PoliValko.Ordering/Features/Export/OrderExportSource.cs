using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Features.Export;

internal sealed class OrderExportSource(PoliValkoDbContext db, ICatalogPricing catalog) : IOrderExportSource
{
    public async Task<OrderForExport> GetAsync(Guid orderId, CancellationToken ct)
    {
        var order = await db.Set<Order>().AsNoTracking().Include(o => o.Items).SingleAsync(o => o.Id == orderId, ct);
        var ids = await catalog.NavkoloIdsAsync(order.Items.Select(i => i.ProductId).ToArray(), ct);
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
            order.Items.Select(i => new OrderForExportLine(i.Sku, i.Name, i.Quantity, i.UnitPrice, ids.GetValueOrDefault(i.ProductId))).ToList(), order.Status, order.NavkoloExportAttemptedAt, order.NavkoloCancellationSynchronizedAt);
    }

    public async Task<bool> BeginExportAsync(Guid orderId, DateTimeOffset at, CancellationToken ct) =>
        await db.Set<Order>().Where(o => o.Id == orderId && o.Status != OrderStatus.Cancelled && o.NavkoloOrderRef == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.NavkoloExportAttemptedAt, o => o.NavkoloExportAttemptedAt ?? at), ct) == 1;

    public async Task MarkExportedAsync(Guid orderId, string reference, DateTimeOffset at, CancellationToken ct) =>
        await db.Set<Order>().Where(o => o.Id == orderId && o.NavkoloOrderRef == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.NavkoloOrderRef, reference).SetProperty(o => o.NavkoloExportedAt, at), ct);

    public async Task MarkCancellationSynchronizedAsync(Guid orderId, DateTimeOffset at, CancellationToken ct) =>
        await db.Set<Order>().Where(o => o.Id == orderId && o.Status == OrderStatus.Cancelled)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.NavkoloCancellationSynchronizedAt, o => o.NavkoloCancellationSynchronizedAt ?? at), ct);
}
