using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PoliValko.Catalog.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Admin.Features.Dashboard;

internal static class GetAdminDashboard
{
    private static readonly int[] AllowedDays = [7, 30, 90];

    private sealed record OrderRow(DateTimeOffset CreatedAt, OrderStatus Status, DeliveryMethod DeliveryMethod, string Phone, decimal Total, decimal RefundedAmount)
    {
        public bool Counts => Status != OrderStatus.Cancelled;

        public decimal Revenue => Counts ? Total - RefundedAmount : 0m;
    }

    public static async Task<Results<Ok<AdminDashboardDto>, ValidationProblem>> HandleAsync(
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
            .Select(r => new OrderRow(r.CreatedAt, r.Status, r.DeliveryMethod, r.Phone, r.Total, r.RefundedAmount))
            .ToList();
        var current = rows.Where(r => r.CreatedAt >= currentFrom).ToList();
        var previous = rows.Where(r => r.CreatedAt < currentFrom).ToList();

        var perDay = current.ToLookup(r => KyivTime.DateOf(r.CreatedAt));
        var byDay = Enumerable.Range(0, n)
            .Select(i => firstDay.AddDays(i))
            .Select(day => new DashboardDayDto(day, perDay[day].Count(), MoneyDto.Hryvnia(perDay[day].Sum(r => r.Revenue))))
            .ToList();

        var byStatus = OrderStatusCounts.From(current.GroupBy(r => r.Status).Select(g => (g.Key, g.Count())));

        var byDelivery = current
            .GroupBy(r => DeliveryCodes.From(r.DeliveryMethod))
            .Select(g => new DashboardDeliveryDto(g.Key, g.Count()))
            .OrderByDescending(d => d.Count)
            .ThenBy(d => d.Method, StringComparer.Ordinal)
            .ToList();

        return TypedResults.Ok(new AdminDashboardDto(
            n,
            Totals(current),
            Totals(previous),
            byDay,
            byStatus,
            await TopProductsAsync(orders, catalog, currentFrom, currentTo, ct),
            await LowStockAsync(catalog, ct),
            byDelivery));
    }

    private static DashboardTotalsDto Totals(IReadOnlyCollection<OrderRow> rows)
    {
        var revenue = rows.Sum(r => r.Revenue);
        var counted = rows.Count(r => r.Counts);
        return new DashboardTotalsDto(
            MoneyDto.Hryvnia(revenue),
            rows.Count,
            MoneyDto.Hryvnia(counted == 0 ? 0m : revenue / counted),
            rows.Select(r => r.Phone).Distinct(StringComparer.Ordinal).Count(),
            rows.Count - counted);
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
