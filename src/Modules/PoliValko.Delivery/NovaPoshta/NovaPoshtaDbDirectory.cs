using Microsoft.EntityFrameworkCore;
using PoliValko.Delivery.Persistence;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Delivery.NovaPoshta;

/// <summary>
/// Довідник Нової пошти з локальної копії в БД (оновлює <see cref="NovaPoshtaSyncJob"/>).
/// Використовується, коли задано <c>Delivery:NovaPoshta:ApiKey</c>. Поведінка пошуку така сама,
/// як у демо: від 2 символів, без запиту — короткий список великих міст, відділення перед поштоматами.
/// </summary>
internal sealed class NovaPoshtaDbDirectory(PoliValkoDbContext db, PickupPointStore pickup) : IDeliveryDirectory
{
    /// <summary>Скільки «популярних» міст показувати без запиту.</summary>
    public const int PopularLimit = 8;

    public const int MinQueryLength = 2;

    public async ValueTask<IReadOnlyList<Settlement>> SearchSettlementsAsync(string? query, int limit, CancellationToken ct) =>
        await SearchSettlements(db.Set<NpSettlement>().AsNoTracking(), query, limit).ToListAsync(ct);

    public async ValueTask<Settlement?> FindSettlementAsync(string reference, CancellationToken ct) =>
        await db.Set<NpSettlement>()
            .AsNoTracking()
            .Where(s => s.Ref == reference && s.IsActive)
            .Select(s => new Settlement(s.Ref, s.Name, s.Area))
            .FirstOrDefaultAsync(ct);

    public async ValueTask<IReadOnlyList<Warehouse>?> GetWarehousesAsync(string settlementRef, string? query, CancellationToken ct)
    {
        if (!await db.Set<NpSettlement>().AnyAsync(s => s.Ref == settlementRef && s.IsActive, ct))
        {
            return null;
        }

        return await WarehousesIn(db.Set<NpWarehouse>().AsNoTracking(), settlementRef, query).ToListAsync(ct);
    }

    public async ValueTask<Warehouse?> FindWarehouseAsync(string reference, CancellationToken ct) =>
        await db.Set<NpWarehouse>()
            .AsNoTracking()
            .Where(w => w.Ref == reference && w.IsActive)
            .Select(w => new Warehouse(w.Ref, w.SettlementRef, w.Number, w.Name, w.Address, w.Type))
            .FirstOrDefaultAsync(ct);

    public ValueTask<PickupPoint> GetPickupAsync(CancellationToken ct) => pickup.GetDefaultAsync(ct);

    /// <summary>
    /// Пошук за початком назви (індекс text_pattern_ops). Точний збіг — першим, далі більші міста.
    /// Показуємо лише пункти, де є хоча б одне робоче відділення чи поштомат.
    /// </summary>
    internal static IQueryable<Settlement> SearchSettlements(IQueryable<NpSettlement> source, string? query, int limit)
    {
        var term = NovaPoshtaText.Normalize(query);
        var active = source.Where(s => s.IsActive && s.ActiveWarehouseCount > 0);

        IQueryable<NpSettlement> found;
        if (term.Length < MinQueryLength)
        {
            found = active
                .OrderByDescending(s => s.ActiveWarehouseCount)
                .ThenBy(s => s.Name)
                .Take(Math.Clamp(limit, 0, PopularLimit));
        }
        else
        {
            var pattern = NovaPoshtaText.EscapeLike(term) + "%";
            found = active
                .Where(s => EF.Functions.Like(s.SearchName, pattern, "\\"))
                .OrderBy(s => s.SearchName == term ? 0 : 1)
                .ThenByDescending(s => s.ActiveWarehouseCount)
                .ThenBy(s => s.Name)
                .Take(Math.Max(limit, 0));
        }

        return found.Select(s => new Settlement(s.Ref, s.Name, s.Area));
    }

    /// <summary>Робочі відділення міста: спершу відділення, потім поштомати, за номером.</summary>
    internal static IQueryable<Warehouse> WarehousesIn(IQueryable<NpWarehouse> source, string settlementRef, string? query)
    {
        var term = NovaPoshtaText.Normalize(query);
        var warehouses = source.Where(w => w.SettlementRef == settlementRef && w.IsActive);
        if (term.Length > 0)
        {
            warehouses = warehouses.Where(w => w.SearchText.Contains(term));
        }

        return warehouses
            .OrderBy(w => w.Type == WarehouseType.Branch ? 0 : 1)
            .ThenBy(w => w.Number)
            .ThenBy(w => w.Name)
            .Select(w => new Warehouse(w.Ref, w.SettlementRef, w.Number, w.Name, w.Address, w.Type));
    }
}
