using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PoliValko.Catalog;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering;
using PoliValko.Ordering.Domain;

namespace PoliValko.Navkolo;

public static class NavkoloJobs
{
    public const string PriceStock = "navkolo.price-stock";
    public const string Catalog = "navkolo.catalog";
    public const string Import = "navkolo.import";
}

/// <summary>Ціни й залишки кожні 5 хвилин (розділ 7 ТЗ).</summary>
internal sealed class NavkoloPriceStockJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<NavkoloPriceStockJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    protected override string Job => NavkoloJobs.PriceStock;

    protected override TimeSpan Interval(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.SyncInterval;

    protected override TimeSpan RetryInterval(IServiceProvider services) => TimeSpan.FromMinutes(1);

    protected override bool IsEnabled(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.IsEnabled;

    protected override async Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct)
    {
        var records = await services.GetRequiredService<INavkoloClient>().GetPriceStockAsync(ct);
        var result = await services.GetRequiredService<ICatalogImporter>().ApplyPriceStockAsync(records, ct);
        return new SyncResult($"Отримано {records.Count} записів. Змінено: {result.Updated}, без змін: {result.Unchanged}", result.Errors);
    }
}

/// <summary>Повний імпорт каталогу: нові товари й поля Navkolo наявних.</summary>
internal sealed class NavkoloCatalogJob(IServiceScopeFactory scopes, TimeProvider time, ILogger<NavkoloCatalogJob> logger)
    : ScheduledJobService(scopes, time, logger)
{
    protected override string Job => NavkoloJobs.Catalog;

    protected override TimeSpan Interval(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.CatalogInterval;

    protected override bool IsEnabled(IServiceProvider services) => services.GetRequiredService<IOptions<NavkoloOptions>>().Value.IsEnabled;

    protected override async Task<SyncResult> RunOnceAsync(IServiceProvider services, CancellationToken ct)
    {
        var records = await services.GetRequiredService<INavkoloClient>().GetCatalogAsync(ct);
        var result = await services.GetRequiredService<ICatalogImporter>().ImportProductsAsync(records, ct);
        return new SyncResult(result.Summary, result.Errors);
    }
}

/// <summary>
/// Ціни свіжі, якщо остання успішна синхронізація цін і залишків молодша за поріг. Інакше
/// замовлення приймається як заявка без онлайн-оплати й без обіцянки резерву (розділ 7 ТЗ).
/// </summary>
internal sealed class NavkoloFreshness(PoliValkoDbContext db, IOptions<NavkoloOptions> options, TimeProvider time) : ICatalogFreshness
{
    public async Task<bool> IsFreshAsync(CancellationToken ct)
    {
        var lastSuccess = await db.Set<SyncState>()
            .AsNoTracking()
            .Where(s => s.Job == NavkoloJobs.PriceStock)
            .Select(s => s.LastSuccessAt)
            .FirstOrDefaultAsync(ct);
        return lastSuccess is { } at && time.GetUtcNow() - at <= options.Value.FreshnessThreshold;
    }
}

/// <summary>
/// Передача нового замовлення в Navkolo через чергу: повтори з наростаючою затримкою, захист від
/// дублікатів за номером, журнал помилок і ручний повтор в адмінці (розділ 7 ТЗ).
/// </summary>
internal sealed class ExportOrderToNavkolo(
    PoliValkoDbContext db,
    INavkoloClient client,
    IOptions<NavkoloOptions> options,
    TimeProvider time) : IOutboxHandler<OrderExportRequested>
{
    public async Task HandleAsync(OrderExportRequested message, CancellationToken cancellationToken)
    {
        if (!options.Value.IsEnabled)
        {
            return;
        }

        var order = await db.Set<Order>().Include(o => o.Items).SingleAsync(o => o.Id == message.OrderId, cancellationToken);
        if (order.NavkoloOrderRef is not null)
        {
            return;
        }

        var delivery = order.DeliveryMethod switch
        {
            DeliveryMethod.Pickup => $"Самовивіз: {order.PickupAddress}",
            DeliveryMethod.NovaPoshtaCourier => $"Кур'єр НП: {order.SettlementName}, {order.DeliveryAddress}",
            _ => $"НП: {order.SettlementName}, {order.WarehouseName}",
        };
        var reference = await client.SendOrderAsync(
            new NavkoloOrder(
                order.Number,
                order.CreatedAt,
                order.CustomerName,
                order.CustomerPhone,
                delivery,
                order.PaymentMethod.ToString(),
                order.Total,
                order.Comment,
                order.Items.Select(i => new NavkoloOrderLine(i.Sku, i.Name, i.Quantity, i.UnitPrice)).ToList()),
            cancellationToken);

        order.MarkExported(reference, time.GetUtcNow());
        await db.SaveChangesAsync(cancellationToken);
    }
}
