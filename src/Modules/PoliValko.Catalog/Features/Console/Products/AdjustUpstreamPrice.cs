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

public sealed record AdjustUpstreamPriceRequest([property: JsonRequired] IReadOnlyList<AdjustUpstreamPriceChange>? Changes);

public sealed record AdjustUpstreamPriceChange(
    [property: JsonRequired] Guid ProductId,
    [property: JsonRequired] string ExpectedSku,
    [property: JsonRequired] decimal ExpectedPrice,
    [property: JsonRequired] decimal? ExpectedOldPrice,
    [property: JsonRequired] DateTimeOffset ExpectedPriceUpdatedAt,
    [property: JsonRequired] decimal Price);

public sealed record AdjustUpstreamPriceResult(int Updated);

public sealed record AdjustUpstreamPriceConflictItem(Guid ProductId, string Reason);

public sealed record AdjustUpstreamPriceConflict(IReadOnlyList<AdjustUpstreamPriceConflictItem> Conflicts);

internal static class AdjustUpstreamPrice
{
    private const int MaxProducts = 200;
    private const decimal MaxPrice = 9_999_999_999.99m;

    public static async Task<Results<Ok<AdjustUpstreamPriceResult>, ValidationProblem, Conflict<AdjustUpstreamPriceConflict>>> HandleAsync(
        AdjustUpstreamPriceRequest request,
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
            string.IsNullOrWhiteSpace(change.ExpectedSku) || change.ExpectedSku.Length > 100 || change.ExpectedSku.Any(char.IsControl) ||
            change.ExpectedPriceUpdatedAt == default || !IsRetailPrice(change.ExpectedPrice) || !IsRetailPrice(change.Price) ||
            (change.ExpectedOldPrice is { } oldPrice && (oldPrice < -MaxPrice || oldPrice > MaxPrice || decimal.Round(oldPrice, 2) != oldPrice))))
        {
            return Invalid("Вкажіть товар, артикул, час оновлення, поточну, перекреслену й нову роздрібні ціни з точністю до копійок. Для відсутньої перекресленої ціни вкажіть null.");
        }

        var ids = changes.Select(change => change.ProductId).Distinct().ToArray();
        if (ids.Length != changes.Count || changes.Select(change => change.ExpectedSku).Distinct(StringComparer.Ordinal).Count() != changes.Count)
        {
            return Invalid("Кожен товар та артикул має бути в запиті лише один раз.");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Keep the same inventory and stock lock order as sync and checkout, then lock the price rows.
        await db.Database.ExecuteSqlAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"navkolo.inventory-sync"}, 0))", ct);
        await reservations.LockAsync(ids, ct);
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM catalog.product_prices WHERE product_id = ANY({ids}) ORDER BY product_id FOR UPDATE", ct);
        var products = await db.Set<Product>().Include(product => product.Price)
            .Where(product => ids.Contains(product.Id)).ToDictionaryAsync(product => product.Id, ct);

        var conflicts = new List<AdjustUpstreamPriceConflictItem>();
        foreach (var change in changes)
        {
            if (!products.TryGetValue(change.ProductId, out var product) || product.Price is null)
            {
                conflicts.Add(new(change.ProductId, "missing_product"));
            }
            else if (!string.Equals(product.Sku, change.ExpectedSku, StringComparison.Ordinal) ||
                product.Price.Amount != change.ExpectedPrice || product.Price.OldAmount != change.ExpectedOldPrice ||
                product.Price.UpdatedAt != change.ExpectedPriceUpdatedAt)
            {
                conflicts.Add(new(change.ProductId, "price_changed"));
            }
            else if (product.Price.OldAmount is { } compareAt && (compareAt > product.Price.Amount) != (compareAt > change.Price))
            {
                conflicts.Add(new(change.ProductId, "compare_at_conflict"));
            }
        }

        if (conflicts.Count > 0)
        {
            return TypedResults.Conflict(new AdjustUpstreamPriceConflict(conflicts));
        }

        var now = time.GetUtcNow();
        var updated = new List<PriceAuditChange>();
        foreach (var change in changes)
        {
            var product = products[change.ProductId];
            var before = product.Price.Amount;
            if (ProductFieldWriter.SetPrice(product, change.Price, product.Price.OldAmount, now))
            {
                updated.Add(new(product.Id, product.Sku, product.NavkoloId, before, change.Price, product.Price.OldAmount));
            }
        }

        if (updated.Count == 0)
        {
            return TypedResults.Ok(new AdjustUpstreamPriceResult(0));
        }

        audit.Record("catalog.upstream_price_adjusted", "Product", null, new { changes = updated });
        // The same storefront data determines purchasing availability and displays the retail price.
        outbox.Enqueue(new StockAvailabilityChanged());
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Ok(new AdjustUpstreamPriceResult(updated.Count));
    }

    private static bool IsRetailPrice(decimal value) => value is >= 0 and <= MaxPrice && decimal.Round(value, 2) == value;

    private static ValidationProblem Invalid(string message) => TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["changes"] = [message] });

    private sealed record PriceAuditChange(Guid ProductId, string Sku, string NavkoloId, decimal Before, decimal After, decimal? CompareAt);
}
