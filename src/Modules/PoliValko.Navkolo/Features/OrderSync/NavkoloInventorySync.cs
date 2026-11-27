using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Configuration;
using PoliValko.Navkolo.Contracts;
using PoliValko.Navkolo.Features.OrderExport;
using PoliValko.Navkolo.Integrations.NavkoloApi;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Navkolo.Features.OrderSync;

internal sealed class NavkoloInventorySync(PoliValkoDbContext db, INavkoloSettings settings,
    INavkoloClient client, ICatalogImporter importer, IOrderStateSync orders, NavkoloOrderGate gate)
{
    public async Task<SyncResult> RunAsync(CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"navkolo.inventory-sync"}, 0))", ct);
        var mode = await settings.GetModeAsync(ct);
        if (mode == NavkoloModes.Disabled) return new SyncResult("Синхронізацію вимкнено.", []);

        var orderSyncEnabled = settings.OrderSyncEnabled;
        ExternalOrderState[] states = [];
        if (orderSyncEnabled)
        {
            var candidates = await client.GetOrderStatesAsync(ct);
            var ids = await orders.TrackedIdsAsync(candidates.Select(s => s.OrderId).ToArray(), ct);
            await gate.LockForSyncAsync(ids, ct);
            await orders.LockAsync(ids, ct);
            // Refresh after any in-flight upload/cancellation finishes. Only touch the locked orders.
            // Gates -> order rows -> stock rows is also the order used by outbound operations/console.
            states = ids.Count == 0 ? [] : (await client.GetOrderStatesAsync(ct)).Where(s => ids.Contains(s.OrderId)).ToArray();
        }

        // Observe shipment BEFORE fetching balances: never release its reserve against an older balance.
        var catalog = mode == NavkoloModes.DnTrade ? await client.GetCatalogAsync(ct) : null;
        if (catalog is { Count: 0 })
        {
            throw new NavkoloUnavailableException("DNTrade повернув порожній каталог. Синхронізацію зупинено, товари не приховано.");
        }

        var records = catalog is null ? await client.GetPriceStockAsync(ct) : [];
        var result = catalog is not null ? await importer.ImportProductsAsync(catalog, ct) : await importer.ApplyPriceStockAsync(records, ct);
        if (result.Errors.Count > 0) throw new NavkoloUnavailableException($"Синхронізацію не застосовано, помилок даних каталогу: {result.Errors.Count}. {string.Join("; ", result.Errors.Take(5).Select(e => $"{e.Item}: {e.Message}"))}");
        if (catalog is not null) await importer.DisableMissingAsync(catalog.Select(p => p.NavkoloId!).ToArray(), ct);

        var changed = 0;
        var syncErrors = new List<SyncError>();
        if (orderSyncEnabled)
        {
            var stockIds = catalog is not null ? catalog.Select(p => p.NavkoloId!).ToHashSet(StringComparer.OrdinalIgnoreCase)
                : records.Select(p => p.NavkoloId).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var applied = await orders.ApplyAsync(states, stockIds, ct);
            changed = applied.Changed;
            syncErrors.AddRange(applied.Errors);
        }
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new SyncResult($"Отримано {catalog?.Count ?? records.Count} записів. Змінено: {result.Updated}, без змін: {result.Unchanged}. Замовлень оновлено: {changed}.", syncErrors);
    }
}
