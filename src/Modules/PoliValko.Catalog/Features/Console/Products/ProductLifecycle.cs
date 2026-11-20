using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
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
        db.Add(new Product
        {
            Id = id, Name = name!, NavkoloId = $"local:{id:N}", Sku = sku!, Slug = slug, CategoryId = input.CategoryId,
            CreatedAt = now, UpdatedAt = now, IsVisible = false,
            Price = new ProductPrice { ProductId = id, UpdatedAt = now },
            Stock = new ProductStock { ProductId = id, UpdatedAt = now }
        });
        audit.Record("catalog.product_created", "Product", sku, new { id, name, input.CategoryId });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return TypedResults.Created($"/api/v1/console/catalog/products/{id}", id);
    }

    public static async Task<Results<NoContent, ProblemHttpResult>> SetArchiveAsync(Guid id, SetProductArchiveRequest input,
        PoliValkoDbContext db, IAuditLog audit, IStorefrontCache storefront, TimeProvider time, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var product = await db.Set<Product>().FromSqlInterpolated($"SELECT * FROM catalog.products WHERE id = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (product is null) return ConsoleProductQueries.ProductNotFound();
        if (product.IsArchived != input.Archived)
        {
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
