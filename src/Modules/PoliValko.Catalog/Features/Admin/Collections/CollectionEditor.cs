using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Admin.Products;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Admin.Collections;

internal static class CollectionEditor
{
    public static async Task<Dictionary<string, string[]>> ApplyCollectionAsync(
        HomeCollection collection,
        SaveCollectionRequest request,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var code = request.Code?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!CatalogAdminValidation.IsSlug(code) || code.Length > 50)
        {
            errors["code"] = ["Код: латинські літери, цифри й дефіси, до 50 символів."];
        }
        else if (await db.Set<HomeCollection>().AnyAsync(c => c.Code == code && c.Id != collection.Id, ct))
        {
            errors["code"] = ["Добірка з таким кодом уже є."];
        }

        var title = request.Title?.Trim();
        if (string.IsNullOrEmpty(title) || title.Length > 200)
        {
            errors["title"] = ["Вкажіть назву до 200 символів."];
        }

        var ids = (request.ProductIds ?? []).Distinct().ToList();
        if (ids.Count > 24)
        {
            errors["productIds"] = ["Не більше 24 товарів у добірці."];
        }
        else if (ids.Count > 0 && await db.Set<Product>().CountAsync(p => ids.Contains(p.Id), ct) != ids.Count)
        {
            errors["productIds"] = ["Частину товарів не знайдено."];
        }

        if (errors.Count == 0)
        {
            collection.Code = code;
            collection.Title = title!;
            collection.SortOrder = request.SortOrder;
            collection.IsVisible = request.IsVisible;
            collection.ProductIds = ids;
        }

        return errors;
    }

    public static AdminCollectionDto ToDto(HomeCollection c, Dictionary<Guid, AdminProductListItemDto> products) => new(
        c.Id, c.Code, c.Title, c.SortOrder, c.IsVisible, c.ProductIds.Where(products.ContainsKey).Select(id => products[id]).ToList());
}
