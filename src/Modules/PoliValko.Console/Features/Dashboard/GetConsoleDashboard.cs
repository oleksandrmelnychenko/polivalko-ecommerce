using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Catalog.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Console.Features.Dashboard;

internal static class GetConsoleDashboard
{
    private static readonly int[] AllowedDays = [7, 30, 90];

    private sealed record OrderRow(
        DateTimeOffset CreatedAt,
        OrderStatus Status,
        DeliveryMethod DeliveryMethod,
        string Phone,
        decimal Total,
        bool CountRevenueWhenCancelled)
    {
        public bool Counts => Status is OrderStatus.Confirmed
            or OrderStatus.Paid
            or OrderStatus.Shipped
            or OrderStatus.ReadyForPickup
            or OrderStatus.Completed;

        public bool CountsForGrossRevenue => Counts || CountRevenueWhenCancelled;
    }

    public static async Task<Results<Ok<ConsoleDashboardDto>, ValidationProblem>> HandleAsync(
        int? days,
        [FromServices] IOrderReporting orders,
        [FromServices] ICatalogReporting catalog,
        TimeProvider time,
        CancellationToken ct)
    {
        var n = days ?? 30;
        if (!AllowedDays.Contains(n))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["days"] = [$"Допустимі значення: {string.Join(", ", AllowedDays)}."],
            });
        }

        var today = KyivTime.Today(time);
        var firstDay = today.AddDays(1 - n);
        var currentFrom = KyivTime.StartOfDay(firstDay);
        var currentTo = KyivTime.StartOfDay(today.AddDays(1));
        var previousFrom = KyivTime.StartOfDay(firstDay.AddDays(-n));

        var rows = (await orders.ListForPeriodAsync(previousFrom, currentTo, ct))
            .Select(r => new OrderRow(r.CreatedAt, r.Status, r.DeliveryMethod, r.Phone, r.Total, r.CountRevenueWhenCancelled))
            .ToList();
        var refunds = await orders.ListRefundsForPeriodAsync(previousFrom, currentTo, ct);

        var current = rows.Where(r => r.CreatedAt >= currentFrom).ToList();
        var previous = rows.Where(r => r.CreatedAt < currentFrom).ToList();
        var currentRefunds = refunds.Where(r => r.CompletedAt >= currentFrom).ToList();
        var previousRefunds = refunds.Where(r => r.CompletedAt < currentFrom).ToList();

        // Only confirmed/paid/fulfilled orders count as recognized orders and sales; unpaid/unconfirmed and cancelled
        // orders remain visible in the breakdown by status. Refunds are attributed by CompletedAt window.
        var counted = current.Where(r => r.Counts).ToList();
        var perDayOrders = counted.ToLookup(r => KyivTime.DateOf(r.CreatedAt));
        var perDayGross = current.Where(r => r.CountsForGrossRevenue).ToLookup(r => KyivTime.DateOf(r.CreatedAt));
        var perDayRefunds = currentRefunds.ToLookup(r => KyivTime.DateOf(r.CompletedAt));
        var byDay = Enumerable.Range(0, n)
            .Select(i => firstDay.AddDays(i))
            .Select(day => new DashboardDayDto(
                day,
                perDayOrders[day].Count(),
                MoneyDto.Hryvnia(perDayGross[day].Sum(r => r.Total) - perDayRefunds[day].Sum(r => r.Amount))))
            .ToList();

        var byStatus = OrderStatusCounts.From(current.GroupBy(r => r.Status).Select(g => (g.Key, g.Count())));

        var byDelivery = counted
            .GroupBy(r => DeliveryCodes.From(r.DeliveryMethod))
            .Select(g => new DashboardDeliveryDto(g.Key, g.Count()))
            .OrderByDescending(d => d.Count)
            .ThenBy(d => d.Method, StringComparer.Ordinal)
            .ToList();

        return TypedResults.Ok(new ConsoleDashboardDto(
            n,
            Totals(current, currentRefunds),
            Totals(previous, previousRefunds),
            byDay,
            byStatus,
            await TopProductsAsync(orders, catalog, currentFrom, currentTo, ct),
            await LowStockAsync(catalog, ct),
            byDelivery));
    }

    private static DashboardTotalsDto Totals(IReadOnlyCollection<OrderRow> rows, IReadOnlyCollection<RefundPeriodRow> refunds)
    {
        var counted = rows.Where(r => r.Counts).ToList();
        var revenue = rows.Where(r => r.CountsForGrossRevenue).Sum(r => r.Total) - refunds.Sum(r => r.Amount);
        var cancelled = rows.Count(r => r.Status == OrderStatus.Cancelled);
        return new DashboardTotalsDto(
            MoneyDto.Hryvnia(revenue),
            counted.Count,
            MoneyDto.Hryvnia(counted.Count == 0 ? 0m : revenue / counted.Count),
            counted.Select(r => r.Phone).Distinct(StringComparer.Ordinal).Count(),
            cancelled);
    }

    private static async Task<List<DashboardTopProductDto>> TopProductsAsync(
        IOrderReporting orders,
        ICatalogReporting products,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken ct)
    {
        var top = await orders.TopProductsAsync(from, to, 5, ct);
        if (top.Count == 0)
        {
            return [];
        }

        var ids = top.Select(t => t.ProductId).ToList();
        var catalog = (await products.GetProductCardsAsync(ids, ct))
            .Select(p => new ProductInfo(p.Id, p.Name, p.Sku, p.ImageUrl))
            .ToDictionary(p => p.Id);

        var missing = ids.Where(id => !catalog.ContainsKey(id)).ToList();
        if (missing.Count > 0)
        {
            var snapshots = (await orders.OrderedProductSnapshotsAsync(missing, ct))
                .Select(i => new ProductInfo(i.ProductId, i.Name, i.Sku, i.ImageUrl))
                .ToList();
            foreach (var s in snapshots.DistinctBy(s => s.Id))
            {
                catalog[s.Id] = s;
            }
        }

        return top
            .Select(t =>
            {
                var info = catalog.GetValueOrDefault(t.ProductId) ?? new ProductInfo(t.ProductId, string.Empty, string.Empty, null);
                return new DashboardTopProductDto(t.ProductId, info.Name, info.Sku, info.ImageUrl, t.Quantity, MoneyDto.Hryvnia(t.Revenue));
            })
            .ToList();
    }

    private sealed record ProductInfo(Guid Id, string Name, string Sku, string? ImageUrl);

    private static async Task<List<DashboardLowStockDto>> LowStockAsync(ICatalogReporting catalog, CancellationToken ct) =>
        (await catalog.GetLowStockAsync(8, ct))
            .Select(p => new DashboardLowStockDto(p.Id, p.Name, p.Sku, p.Stock))
            .ToList();
}
