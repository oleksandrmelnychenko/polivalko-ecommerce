using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Import;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Products;

public sealed record AdjustUpstreamStockRequest([property: JsonRequired] IReadOnlyList<AdjustUpstreamStockChange>? Changes);

public sealed record AdjustUpstreamStockChange(
    [property: JsonRequired] Guid ProductId,
    [property: JsonRequired] string ExpectedNavkoloId,
    [property: JsonRequired] decimal ExpectedQuantity,
    [property: JsonRequired] DateTimeOffset ExpectedStockUpdatedAt,
    [property: JsonRequired] decimal Quantity);

public sealed record AdjustUpstreamStockResult(int Updated);

public sealed record AdjustUpstreamStockConflictItem(Guid ProductId, string Reason);

public sealed record AdjustUpstreamStockConflict(IReadOnlyList<AdjustUpstreamStockConflictItem> Conflicts);

internal static class AdjustUpstreamStock
{
    private const int MaxProducts = 200;
    private const decimal MaxQuantity = 999_999_999.999m;

    public static async Task<Results<Ok<AdjustUpstreamStockResult>, ValidationProblem, Conflict<AdjustUpstreamStockConflict>>> HandleAsync(
        AdjustUpstreamStockRequest request,
        PoliValkoDbContext db,
        ICatalogReservations reservations,
        IAuditLog audit,
        IOutbox outbox,
        TimeProvider time,
        CancellationToken ct)
    {
        var changes = request.Changes;
        if (changes is null || changes.Count is 0 or > MaxProducts)
        {
            return Invalid($"Оберіть від 1 до {MaxProducts} товарів.");
        }

        if (changes.Any(change => change is null || change.ProductId == Guid.Empty ||
            string.IsNullOrWhiteSpace(change.ExpectedNavkoloId) || change.ExpectedNavkoloId.Length > 100 ||
            change.ExpectedStockUpdatedAt == default || !IsQuantity(change.ExpectedQuantity) || !IsQuantity(change.Quantity)))
        {
            return Invalid("Вкажіть товар, ідентифікатор джерела, час оновлення, старий і новий залишки з точністю до трьох знаків після коми.");
        }

        var ids = changes.Select(change => change.ProductId).Distinct().ToArray();
        if (ids.Length != changes.Count)
        {
            return Invalid("Кожен товар має бути в запиті лише один раз.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Serialize with an in-flight Navkolo fetch before taking the same row locks used by checkout.
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"navkolo.inventory-sync"}, 0))", ct);
        await reservations.LockAsync(ids, ct);
        var products = await db.Set<Product>().Include(product => product.Stock)
            .Where(product => ids.Contains(product.Id)).ToDictionaryAsync(product => product.Id, ct);

        var conflicts = new List<AdjustUpstreamStockConflictItem>();
        foreach (var change in changes)
        {
            if (!products.TryGetValue(change.ProductId, out var product) || product.Stock is null)
            {
                conflicts.Add(new(change.ProductId, "missing_product"));
            }
            else if (product.Stock.WarehouseStoreId.HasValue)
            {
                conflicts.Add(new(change.ProductId, "warehouse_managed"));
            }
            else if (!string.Equals(product.NavkoloId, change.ExpectedNavkoloId, StringComparison.Ordinal) ||
                product.Stock.Quantity != change.ExpectedQuantity || product.Stock.UpdatedAt != change.ExpectedStockUpdatedAt)
            {
                conflicts.Add(new(change.ProductId, "stock_changed"));
            }
            else if (change.Quantity < product.Stock.ReservedQuantity)
            {
                conflicts.Add(new(change.ProductId, "reserved_stock"));
            }
        }

        if (conflicts.Count > 0)
        {
            return TypedResults.Conflict(new AdjustUpstreamStockConflict(conflicts));
        }

        var now = time.GetUtcNow();
        var updated = new List<StockAuditChange>();
        foreach (var change in changes)
        {
            var product = products[change.ProductId];
            var before = product.Stock.Quantity;
            if (ProductFieldWriter.SetStock(product, change.Quantity, now))
            {
                updated.Add(new(product.Id, product.Sku, product.NavkoloId, before, change.Quantity, product.Stock.ReservedQuantity));
            }
        }

        if (updated.Count == 0)
        {
            return TypedResults.Ok(new AdjustUpstreamStockResult(0));
        }

        audit.Record("catalog.upstream_stock_adjusted", "Product", null, new { changes = updated });
        outbox.Enqueue(new StockAvailabilityChanged());
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(new AdjustUpstreamStockResult(updated.Count));
    }

    private static bool IsQuantity(decimal value) => value is >= 0 and <= MaxQuantity && decimal.Round(value, 3) == value;

    private static ValidationProblem Invalid(string message) => TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["changes"] = [message] });

    private sealed record StockAuditChange(Guid ProductId, string Sku, string NavkoloId, decimal Before, decimal After, decimal ReservedQuantity);
}
