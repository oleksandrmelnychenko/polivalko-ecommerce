using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Api;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Ordering.Api;
using PoliValko.Ordering.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Api;

/// <summary>
/// Підсумки за період. Виручка — нескасовані замовлення за вирахуванням повернень;
/// <see cref="Orders"/> — усі створені замовлення, зокрема скасовані; середній чек — виручка
/// на нескасоване замовлення; <see cref="Customers"/> — різні телефони.
/// </summary>
public sealed record DashboardTotalsDto(MoneyDto Revenue, int Orders, MoneyDto AverageOrder, int Customers, int Cancelled);

/// <summary>Один київський день періоду. Дні без замовлень теж є (з нулями).</summary>
public sealed record DashboardDayDto(DateOnly Date, int Orders, MoneyDto Revenue);

/// <summary>Найпродаваніший товар періоду за виручкою (сума позицій нескасованих замовлень).</summary>
public sealed record DashboardTopProductDto(Guid ProductId, string Name, string Sku, string? ImageUrl, int Quantity, MoneyDto Revenue);

/// <summary>Видимий товар, що закінчується (залишок до 3 включно, зокрема 0).</summary>
public sealed record DashboardLowStockDto(Guid Id, string Name, string Sku, decimal Stock);

/// <summary>Кількість замовлень періоду за кодом способу отримання (nova_poshta, nova_poshta_courier, pickup).</summary>
public sealed record DashboardDeliveryDto(string Method, int Count);

/// <summary>
/// Зведення адмінки за останні <see cref="Days"/> київських днів (включно з сьогодні) і порівняння
/// з такою самою кількістю днів перед ними.
/// </summary>
public sealed record AdminDashboardDto(
    int Days,
    DashboardTotalsDto Current,
    DashboardTotalsDto Previous,
    IReadOnlyList<DashboardDayDto> ByDay,
    IReadOnlyList<OrderStatusCountDto> ByStatus,
    IReadOnlyList<DashboardTopProductDto> TopProducts,
    IReadOnlyList<DashboardLowStockDto> LowStock,
    IReadOnlyList<DashboardDeliveryDto> ByDelivery);

internal static class AdminDashboard
{
    private static readonly int[] AllowedDays = [7, 30, 90];

    // Зведення читає замовлення й каталог, тому живе в хості API, а не в одному з модулів.
    public static RouteGroupBuilder MapAdminDashboard(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/dashboard").WithTags("Admin").RequireStaff()
            .MapGet(string.Empty, GetAsync)
            .WithName("AdminDashboard")
            .WithSummary("Виручка, замовлення, середній чек і покупці за 7, 30 чи 90 днів із порівнянням, динаміка по днях, топ товарів, залишки");
        return admin;
    }

    private sealed record OrderRow(DateTimeOffset CreatedAt, OrderStatus Status, DeliveryMethod DeliveryMethod, string Phone, decimal Total, decimal RefundedAmount)
    {
        public bool Counts => Status != OrderStatus.Cancelled;

        /// <summary>Виручка замовлення: скасоване не рахується, повернення віднімаються.</summary>
        public decimal Revenue => Counts ? Total - RefundedAmount : 0m;
    }

    private static async Task<Results<Ok<AdminDashboardDto>, ValidationProblem>> GetAsync(
        int? days,
        PoliValkoDbContext db,
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

        // Замовлень за два періоди небагато (до 180 днів), тож групування за київськими днями — у пам'яті.
        var rows = await db.Set<Order>().AsNoTracking()
            .Where(o => o.CreatedAt >= previousFrom && o.CreatedAt < currentTo)
            .Select(o => new OrderRow(o.CreatedAt, o.Status, o.DeliveryMethod, o.CustomerPhone, o.Total, o.RefundedAmount))
            .ToListAsync(ct);
        var current = rows.Where(r => r.CreatedAt >= currentFrom).ToList();
        var previous = rows.Where(r => r.CreatedAt < currentFrom).ToList();

        var perDay = current.ToLookup(r => KyivTime.DateOf(r.CreatedAt));
        var byDay = Enumerable.Range(0, n)
            .Select(i => firstDay.AddDays(i))
            .Select(day => new DashboardDayDto(day, perDay[day].Count(), MoneyDto.Hryvnia(perDay[day].Sum(r => r.Revenue))))
            .ToList();

        var byStatus = AdminOrderEndpoints.ToStatusCounts(current.GroupBy(r => r.Status).Select(g => (g.Key, g.Count())));

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
            await TopProductsAsync(db, currentFrom, currentTo, ct),
            await LowStockAsync(db, ct),
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
        PoliValkoDbContext db,
        DateTimeOffset from,
        DateTimeOffset to,
        CancellationToken ct)
    {
        var top = await db.Set<Order>().AsNoTracking()
            .Where(o => o.CreatedAt >= from && o.CreatedAt < to && o.Status != OrderStatus.Cancelled)
            .SelectMany(o => o.Items)
            .GroupBy(i => i.ProductId)
            .Select(g => new { ProductId = g.Key, Quantity = g.Sum(i => i.Quantity), Revenue = g.Sum(i => i.LineTotal) })
            .OrderByDescending(x => x.Revenue)
            .ThenByDescending(x => x.Quantity)
            .ThenBy(x => x.ProductId)
            .Take(5)
            .ToListAsync(ct);
        if (top.Count == 0)
        {
            return [];
        }

        // Назва й фото — поточні з каталогу; якщо товару вже немає, то знімок із позиції замовлення.
        var ids = top.Select(t => t.ProductId).ToList();
        var catalog = await db.Set<Product>().AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new ProductInfo(
                p.Id,
                p.DisplayName ?? p.Name,
                p.Sku,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault()))
            .ToDictionaryAsync(p => p.Id, ct);

        var missing = ids.Where(id => !catalog.ContainsKey(id)).ToList();
        if (missing.Count > 0)
        {
            var snapshots = await db.Set<OrderItem>().AsNoTracking()
                .Where(i => missing.Contains(i.ProductId))
                .Select(i => new ProductInfo(i.ProductId, i.Name, i.Sku, i.ImageUrl))
                .ToListAsync(ct);
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

    private static Task<List<DashboardLowStockDto>> LowStockAsync(PoliValkoDbContext db, CancellationToken ct) =>
        db.Set<Product>().AsNoTracking()
            .Where(p => p.IsVisible && p.Stock.Quantity <= ProductStockFilters.LowStockThreshold)
            .OrderBy(p => p.Stock.Quantity)
            .ThenBy(p => p.DisplayName ?? p.Name)
            .ThenBy(p => p.Id)
            .Take(8)
            .Select(p => new DashboardLowStockDto(p.Id, p.DisplayName ?? p.Name, p.Sku, p.Stock.Quantity))
            .ToListAsync(ct);
}
