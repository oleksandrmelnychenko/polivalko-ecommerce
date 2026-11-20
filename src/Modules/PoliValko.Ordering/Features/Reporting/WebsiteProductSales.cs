using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Reporting;

internal sealed class WebsiteProductSales(PoliValkoDbContext db) : IWebsiteProductSales
{
    public async Task<ProductSalesData> ReadAsync(DateOnly from, DateOnly to, CancellationToken ct)
    {
        var start = KyivTime.StartOfDay(from);
        var end = KyivTime.StartOfDay(to.AddDays(1));
        var orders = db.Set<Order>().AsNoTracking().Where(o =>
            ProductSalesSource.SoldStatuses.Contains(o.Status) ||
            (o.Status == OrderStatus.Cancelled && o.History.Any(h => h.To == OrderStatus.Paid) &&
                o.Refunds.Any(r => r.Status == RefundStatus.Succeeded && r.Lines.Any())));
        var sold = orders.Where(o => o.CreatedAt < end && o.Items.Any());
        var succeededRefunds = orders.SelectMany(o => o.Refunds).Where(r => r.Status == RefundStatus.Succeeded);
        var itemizedRefunds = succeededRefunds.Where(r => r.CompletedAt < end && r.Lines.Any());

        var firstSale = await sold.MinAsync(o => (DateTimeOffset?)o.CreatedAt, ct);
        var lastSale = await sold.MaxAsync(o => (DateTimeOffset?)o.CreatedAt, ct);
        var lastReturn = await itemizedRefunds.MaxAsync(r => r.CompletedAt, ct);

        var rows = new Dictionary<(DateOnly, Guid), ProductSalesDay>();
        var saleLines = sold.Where(o => o.CreatedAt >= start)
            .SelectMany(o => o.Items.Select(i => new { o.CreatedAt, i.ProductId, i.Name, i.Sku, i.Quantity, i.LineTotal }));
        await foreach (var item in saleLines.AsAsyncEnumerable().WithCancellation(ct))
        {
            var date = KyivTime.DateOf(item.CreatedAt);
            var row = GetRow(rows, date, item.ProductId, item.Name, item.Sku);
            rows[(date, item.ProductId)] = row with
            {
                SoldUnits = row.SoldUnits + item.Quantity,
                GrossRevenue = row.GrossRevenue + item.LineTotal,
            };
        }

        var returnLines = itemizedRefunds.Where(r => r.CompletedAt >= start)
            .SelectMany(r => r.Lines.Select(l => new { r.CompletedAt, l.OrderItemId, l.Quantity, l.Amount }))
            .Join(db.Set<OrderItem>().AsNoTracking(), l => l.OrderItemId, i => i.Id,
                (l, i) => new { l.CompletedAt, i.ProductId, i.Name, i.Sku, l.Quantity, l.Amount });
        await foreach (var item in returnLines.AsAsyncEnumerable().WithCancellation(ct))
        {
            var date = KyivTime.DateOf(item.CompletedAt!.Value);
            var row = GetRow(rows, date, item.ProductId, item.Name, item.Sku);
            rows[(date, item.ProductId)] = row with
            {
                ReturnedUnits = row.ReturnedUnits + item.Quantity,
                ReturnValue = row.ReturnValue + item.Amount,
            };
        }

        var ignored = await succeededRefunds.CountAsync(r => (r.CompletedAt ?? r.CreatedAt) >= start
            && (r.CompletedAt ?? r.CreatedAt) < end && (r.CompletedAt == null || !r.Lines.Any()), ct);
        var latest = lastReturn > lastSale ? lastReturn : lastSale ?? lastReturn;
        return new ProductSalesData(rows.Values.ToArray(), DayOf(firstSale), DayOf(latest), ignored, 0, true);
    }

    private static ProductSalesDay GetRow(Dictionary<(DateOnly, Guid), ProductSalesDay> rows,
        DateOnly day, Guid id, string name, string sku) =>
        rows.TryGetValue((day, id), out var row) ? row : new(day, id.ToString(), id, name, sku, 0, 0, 0, 0);

    private static DateOnly? DayOf(DateTimeOffset? instant) => instant is { } value ? KyivTime.DateOf(value) : null;
}
