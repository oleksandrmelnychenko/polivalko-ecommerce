using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog;

/// <summary>Актуальні ціна й залишок товару для перерахунку кошика на сервері.</summary>
public sealed record ProductPricing(
    Guid Id,
    string Slug,
    string Sku,
    string Name,
    string? ImageUrl,
    decimal Price,
    decimal Stock,
    bool IsVisible);

/// <summary>Публічний контракт модуля каталогу для оформлення замовлень.</summary>
public interface ICatalogPricing
{
    Task<IReadOnlyDictionary<Guid, ProductPricing>> GetAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct);
}

/// <summary>Чи свіжі ціни й залишки. Якщо ні, замовлення приймається як заявка без онлайн-оплати.</summary>
public interface ICatalogFreshness
{
    Task<bool> IsFreshAsync(CancellationToken ct);
}

internal sealed class CatalogPricing(PoliValkoDbContext db) : ICatalogPricing
{
    public async Task<IReadOnlyDictionary<Guid, ProductPricing>> GetAsync(IReadOnlyCollection<Guid> productIds, CancellationToken ct)
    {
        var ids = productIds.Distinct().ToList();
        return await db.Set<Product>()
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new ProductPricing(
                p.Id,
                p.Slug,
                p.Sku,
                p.DisplayName ?? p.Name,
                p.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                p.Price.Amount,
                p.Stock.Quantity,
                p.IsVisible))
            .ToDictionaryAsync(p => p.Id, ct);
    }
}

/// <summary>
/// Заглушка, доки немає синхронізації з Navkolo: дані вважаються свіжими. Згодом тут буде
/// порівняння часу останньої успішної синхронізації з погодженим порогом.
/// </summary>
internal sealed class AlwaysFreshCatalog : ICatalogFreshness
{
    public Task<bool> IsFreshAsync(CancellationToken ct) => Task.FromResult(true);
}
