using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Pricing;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Features.Console.Products;

public sealed record CreateCatalogProductRequest(string Name, string Sku, Guid CategoryId);
public sealed record SetProductArchiveRequest(bool Archived);

internal static class ProductLifecycle
{
    public static async Task<Results<Created<Guid>, ValidationProblem>> CreateAsync(CreateCatalogProductRequest input,
        PoliValkoDbContext db, IAuditLog audit, TimeProvider time, CancellationToken ct)
    {
        var name = input.Name?.Trim();
        var sku = input.Sku?.Trim();
        var errors = new Dictionary<string, string[]>();
        if (name is not { Length: > 0 and <= 500 }) errors["name"] = ["Введіть назву до 500 символів."];
        if (sku is not { Length: > 0 and <= 100 }) errors["sku"] = ["Введіть артикул до 100 символів."];
        if (!await db.Set<Category>().AnyAsync(c => c.Id == input.CategoryId, ct))
            errors["categoryId"] = ["Оберіть категорію."];
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Imported SKUs have a non-unique index. Serialize manual creation with other catalog writers.
        await db.Database.ExecuteSqlRawAsync("LOCK TABLE catalog.products IN SHARE ROW EXCLUSIVE MODE", ct);
        var key = sku!.ToLowerInvariant();
        if (await db.Set<Product>().AnyAsync(p => p.Sku.ToLower() == key, ct))
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["sku"] = ["Цей артикул уже є в каталозі або архіві."] });
        var now = time.GetUtcNow();
        var id = Guid.CreateVersion7(now);
        var slugBase = Transliteration.ToSlug(name!);
        slugBase = slugBase.Length > 240 ? slugBase[..240].TrimEnd('-') : slugBase;
        var slug = slugBase.Length > 0 ? slugBase : "product";
        if (await db.Set<Product>().AnyAsync(p => p.Slug == slug, ct)) slug = $"{slug}-{id:N}";
        var defaultWarehouse = await CatalogWarehouseSource.ReadDefaultWarehouseAsync(db, ct);
        db.Add(new Product
        {
            Id = id, Name = name!, NavkoloId = $"local:{id:N}", Sku = sku!, Slug = slug, CategoryId = input.CategoryId,
            CreatedAt = now, UpdatedAt = now, IsVisible = false,
            Price = new ProductPrice { ProductId = id, UpdatedAt = now },
            Stock = new ProductStock
            {
                ProductId = id,
                UpdatedAt = now,
            }
        });
        audit.Record("catalog.product_created", "Product", sku, new
        {
            id,
            name,
            input.CategoryId,
            warehouseOrgId = defaultWarehouse?.OrgId,
            warehouseStoreId = defaultWarehouse?.StoreId,
        });
        await db.SaveChangesAsync(ct);
        if (defaultWarehouse is { } dw)
        {
            // catalog.product_stock has a composite FK to accounting.warehouse_stock(org_id, store_id, product_id).
            await db.Database.ExecuteSqlAsync($"""
                INSERT INTO accounting.warehouse_stock(org_id, store_id, product_id, quantity)
                VALUES ({dw.OrgId}, {dw.StoreId}, {id}, 0)
                ON CONFLICT DO NOTHING
                """, ct);
            await db.Database.ExecuteSqlAsync($"""
                UPDATE catalog.product_stock
                SET warehouse_org_id = {dw.OrgId}, warehouse_store_id = {dw.StoreId}, updated_at = {now}
                WHERE product_id = {id}
                """, ct);
        }
        await transaction.CommitAsync(ct);
        return TypedResults.Created($"/api/v1/console/catalog/products/{id}", id);
    }

    public static async Task<Results<NoContent, ProblemHttpResult>> SetArchiveAsync(Guid id, SetProductArchiveRequest input,
        PoliValkoDbContext db, ICatalogReservations reservations, IAuditLog audit, IStorefrontCache storefront, TimeProvider time, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (input.Archived)
        {
            await reservations.LockAsync([id], ct);
        }

        var product = await db.Set<Product>().FromSql($"SELECT * FROM catalog.products WHERE id = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (product is null) return ConsoleProductQueries.ProductNotFound();
        if (product.IsArchived != input.Archived)
        {
            if (input.Archived)
            {
                var reserved = await db.Set<ProductStock>().AsNoTracking()
                    .Where(s => s.ProductId == id)
                    .Select(s => s.ReservedQuantity)
                    .SingleOrDefaultAsync(ct);
                if (reserved > 0m)
                {
                    return Problems.Create(
                        StatusCodes.Status409Conflict,
                        "catalog.product_archive_blocked",
                        "Не можна архівувати товар",
                        "Товар має активні резерви в замовленнях. Завершіть або скасуйте їх перед архівацією.");
                }

                var warehouseQuantity = await db.Database.SqlQuery<decimal>($"""
                    SELECT COALESCE(SUM(quantity), 0) AS "Value"
                    FROM accounting.warehouse_stock
                    WHERE product_id = {id}
                    """).SingleAsync(ct);
                if (warehouseQuantity > 0m)
                {
                    return Problems.Create(
                        StatusCodes.Status409Conflict,
                        "catalog.product_archive_blocked",
                        "Не можна архівувати товар",
                        "На складах обліковується додатний залишок цього товару. Спишіть залишки перед архівацією.");
                }
            }

            product.IsArchived = input.Archived;
            product.IsVisible = false;
            product.UpdatedAt = now;
            audit.Record(input.Archived ? "catalog.product_archived" : "catalog.product_restored", "Product", product.Sku, new { id });
            await db.SaveChangesAsync(ct);
        }
        await transaction.CommitAsync(ct);
        await storefront.InvalidateAsync(ConsoleProductQueries.ProductTags, ct);
        return TypedResults.NoContent();
    }
}
