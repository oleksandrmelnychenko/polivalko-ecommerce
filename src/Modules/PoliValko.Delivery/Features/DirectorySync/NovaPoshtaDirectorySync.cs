using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PoliValko.Delivery.Contracts;
using PoliValko.Delivery.Domain;
using PoliValko.Delivery.Integrations.NovaPoshta;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Delivery.Features.DirectorySync;

internal sealed class NovaPoshtaDirectorySync(
    PoliValkoDbContext db,
    NovaPoshtaClient client,
    TimeProvider time,
    ILogger<NovaPoshtaDirectorySync> logger)
{
    internal const string RecountActiveWarehousesSql = """
        UPDATE delivery.np_settlements AS s
        SET active_warehouse_count = c.active
        FROM (
            SELECT s2.ref, count(w.ref)::int AS active
            FROM delivery.np_settlements AS s2
            LEFT JOIN delivery.np_warehouses AS w ON w.settlement_ref = s2.ref AND w.is_active
            GROUP BY s2.ref
        ) AS c
        WHERE c.ref = s.ref AND s.active_warehouse_count <> c.active
        """;

    private const long TicksPerMicrosecond = TimeSpan.TicksPerMillisecond / 1000;

    public async Task<SyncResult> RunAsync(CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var runAt = new DateTimeOffset(now.Ticks - (now.Ticks % TicksPerMicrosecond), TimeSpan.Zero);

        var areas = await client.GetAreasAsync(ct);

        var settlementsBefore = await db.Set<NpSettlement>().CountAsync(s => s.IsActive, ct);
        var settlements = new Counts();
        await foreach (var page in client.GetCityPagesAsync(areas, ct))
        {
            await UpsertSettlementsAsync(page, runAt, settlements, ct);
        }

        EnsurePlausible(settlements.Seen.Count, settlementsBefore, "населених пунктів");

        var warehousesBefore = await db.Set<NpWarehouse>().CountAsync(w => w.IsActive, ct);
        var warehouses = new Counts();
        await foreach (var page in client.GetWarehousePagesAsync(ct))
        {
            await UpsertWarehousesAsync(page, runAt, warehouses, ct);
        }

        EnsurePlausible(warehouses.Seen.Count, warehousesBefore, "відділень і поштоматів");

        warehouses.Deactivated = await db.Set<NpWarehouse>()
            .Where(w => w.IsActive && w.LastSeenAt < runAt)
            .ExecuteUpdateAsync(setters => setters.SetProperty(w => w.IsActive, false), ct);
        settlements.Deactivated = await db.Set<NpSettlement>()
            .Where(s => s.IsActive && s.LastSeenAt < runAt)
            .ExecuteUpdateAsync(setters => setters.SetProperty(s => s.IsActive, false), ct);
        await db.Database.ExecuteSqlRawAsync(RecountActiveWarehousesSql, ct);

        var summary =
            $"Населені пункти: {settlements.Seen.Count} (нових {settlements.Added}, змінено {settlements.Updated}, вимкнено {settlements.Deactivated}). " +
            $"Відділення й поштомати: {warehouses.Seen.Count} (нових {warehouses.Added}, змінено {warehouses.Updated}, вимкнено {warehouses.Deactivated}).";
        logger.LogInformation("Довідник Нової пошти оновлено. {Summary}", summary);
        return SyncResult.Ok(summary);
    }

    private async Task UpsertSettlementsAsync(IReadOnlyList<Settlement> page, DateTimeOffset runAt, Counts counts, CancellationToken ct)
    {
        var items = page.Where(s => counts.Seen.Add(s.Ref)).ToList();
        if (items.Count == 0)
        {
            return;
        }

        var refs = items.Select(s => s.Ref).ToList();
        var existing = await db.Set<NpSettlement>().Where(s => refs.Contains(s.Ref)).ToDictionaryAsync(s => s.Ref, ct);
        foreach (var item in items)
        {
            var search = NovaPoshtaText.Normalize(item.Name);
            if (existing.TryGetValue(item.Ref, out var row))
            {
                if (row.Name != item.Name || row.Area != item.Area || row.SearchName != search || !row.IsActive)
                {
                    counts.Updated++;
                }

                row.Name = item.Name;
                row.Area = item.Area;
                row.SearchName = search;
                row.IsActive = true;
                row.LastSeenAt = runAt;
            }
            else
            {
                db.Add(new NpSettlement
                {
                    Ref = item.Ref,
                    Name = item.Name,
                    Area = item.Area,
                    SearchName = search,
                    IsActive = true,
                    LastSeenAt = runAt,
                });
                counts.Added++;
            }
        }

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
    }

    private async Task UpsertWarehousesAsync(IReadOnlyList<Warehouse> page, DateTimeOffset runAt, Counts counts, CancellationToken ct)
    {
        var items = page.Where(w => counts.Seen.Add(w.Ref)).ToList();
        if (items.Count == 0)
        {
            return;
        }

        var refs = items.Select(w => w.Ref).ToList();
        var existing = await db.Set<NpWarehouse>().Where(w => refs.Contains(w.Ref)).ToDictionaryAsync(w => w.Ref, ct);
        foreach (var item in items)
        {
            var search = SearchText(item.Name, item.Address);
            if (existing.TryGetValue(item.Ref, out var row))
            {
                if (row.SettlementRef != item.SettlementRef || row.Number != item.Number || row.Name != item.Name
                    || row.Address != item.Address || row.Type != item.Type || !row.IsActive)
                {
                    counts.Updated++;
                }

                row.SettlementRef = item.SettlementRef;
                row.Number = item.Number;
                row.Name = item.Name;
                row.Address = item.Address;
                row.Type = item.Type;
                row.SearchText = search;
                row.IsActive = true;
                row.LastSeenAt = runAt;
            }
            else
            {
                db.Add(new NpWarehouse
                {
                    Ref = item.Ref,
                    SettlementRef = item.SettlementRef,
                    Number = item.Number,
                    Name = item.Name,
                    Address = item.Address,
                    Type = item.Type,
                    SearchText = search,
                    IsActive = true,
                    LastSeenAt = runAt,
                });
                counts.Added++;
            }
        }

        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
    }

    internal static string SearchText(string name, string address) =>
        NovaPoshtaText.Truncate(NovaPoshtaText.Normalize($"{name} {address}"), DeliveryLimits.WarehouseSearchLength);

    private static void EnsurePlausible(int seen, int activeBefore, string what)
    {
        if (seen == 0 || seen < activeBefore / 2)
        {
            throw new NovaPoshtaException(
                $"Нова пошта повернула замало {what}: {seen}, хоча в локальній копії активних {activeBefore}. Записи не вимкнено, перевірте API.");
        }
    }

    private sealed class Counts
    {
        public HashSet<string> Seen { get; } = new(StringComparer.Ordinal);

        public int Added { get; set; }

        public int Updated { get; set; }

        public int Deactivated { get; set; }
    }
}
