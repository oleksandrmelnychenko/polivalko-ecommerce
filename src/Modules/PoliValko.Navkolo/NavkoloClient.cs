using PoliValko.Catalog;
using PoliValko.Catalog.Persistence;

namespace PoliValko.Navkolo;

public sealed class NavkoloOptions
{
    /// <summary>
    /// <c>Disabled</c> — синхронізації немає, ціни вважаються підтвердженими (прототип).
    /// <c>Stub</c> — заглушка клієнта Navkolo з демо-даними: працює весь контур синхронізації.
    /// Справжній клієнт з'явиться після технічної перевірки API (розділ 7 ТЗ).
    /// </summary>
    public string Mode { get; set; } = NavkoloModes.Disabled;

    /// <summary>Цільова періодичність оновлення цін і залишків — 5 хвилин.</summary>
    public TimeSpan SyncInterval { get; set; } = TimeSpan.FromMinutes(5);

    /// <summary>Повний імпорт каталогу.</summary>
    public TimeSpan CatalogInterval { get; set; } = TimeSpan.FromDays(1);

    /// <summary>Якщо останнє успішне оновлення цін старіше, замовлення приймається як заявка без онлайн-оплати.</summary>
    public TimeSpan FreshnessThreshold { get; set; } = TimeSpan.FromMinutes(20);

    public StubOptions Stub { get; set; } = new();

    public bool IsEnabled => !string.Equals(Mode, NavkoloModes.Disabled, StringComparison.OrdinalIgnoreCase);
}

public sealed class StubOptions
{
    /// <summary>Імітація недоступності ERP для перевірки сценаріїв збою й відновлення.</summary>
    public bool SimulateOutage { get; set; }
}

public static class NavkoloModes
{
    public const string Disabled = "Disabled";
    public const string Stub = "Stub";
}

public sealed record NavkoloOrderLine(string Sku, string Name, int Quantity, decimal UnitPrice);

public sealed record NavkoloOrder(
    string Number,
    DateTimeOffset CreatedAt,
    string CustomerName,
    string CustomerPhone,
    string Delivery,
    string Payment,
    decimal Total,
    string? Comment,
    IReadOnlyList<NavkoloOrderLine> Lines);

/// <summary>
/// Межа інтеграції з ERP Navkolo. Методи відповідають операціям з розділу 7 ТЗ; форма запитів
/// фіксується після отримання документації API.
/// </summary>
public interface INavkoloClient
{
    Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct);

    Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct);

    /// <summary>Передає замовлення й повертає його номер у Navkolo. Повтор з тим самим номером не дублює.</summary>
    Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct);
}

/// <summary>Navkolo тимчасово недоступна.</summary>
public sealed class NavkoloUnavailableException(string message) : Exception(message);

/// <summary>
/// Заглушка Navkolo: віддає демо-каталог (той самий, що й демо-наповнення), ціни й залишки з нього
/// та приймає замовлення. Дає змогу перевірити синхронізацію, застарілі дані й відновлення без доступу до ERP.
/// </summary>
internal sealed class StubNavkoloClient(Microsoft.Extensions.Options.IOptionsMonitor<NavkoloOptions> options) : INavkoloClient
{
    public async Task<IReadOnlyList<NavkoloProductRecord>> GetCatalogAsync(CancellationToken ct)
    {
        ThrowIfOutage();
        return await CatalogDemoData.LoadNavkoloRecordsAsync(ct);
    }

    public async Task<IReadOnlyList<PriceStockRecord>> GetPriceStockAsync(CancellationToken ct)
    {
        ThrowIfOutage();
        return (await CatalogDemoData.LoadNavkoloRecordsAsync(ct))
            .Select(r => new PriceStockRecord(r.NavkoloId!, r.Price!.Value, r.OldPrice, r.Stock ?? 0))
            .ToList();
    }

    public Task<string> SendOrderAsync(NavkoloOrder order, CancellationToken ct)
    {
        ThrowIfOutage();
        return Task.FromResult($"NK-{order.Number}");
    }

    private void ThrowIfOutage()
    {
        if (options.CurrentValue.Stub.SimulateOutage)
        {
            throw new NavkoloUnavailableException("Navkolo недоступна (імітація збою в заглушці).");
        }
    }
}
