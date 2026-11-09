using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Persistence;

internal static class CatalogVisibility
{
    public static async Task<List<Category>> CategoriesAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var categories = await db.Set<Category>().AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync(ct);
        var children = categories.ToLookup(c => c.ParentId);
        var visible = new HashSet<Guid>();
        var pending = new Queue<Category>(children[null]);
        while (pending.TryDequeue(out var category))
        {
            if (!category.IsVisible || !visible.Add(category.Id)) continue;
            foreach (var child in children[category.Id]) pending.Enqueue(child);
        }

        return categories.Where(c => visible.Contains(c.Id)).ToList();
    }

    public static async Task<IQueryable<Product>> ProductsAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var ids = (await CategoriesAsync(db, ct)).Select(c => c.Id).ToArray();
        return db.Set<Product>().AsNoTracking().Where(p => p.IsVisible && ids.Contains(p.CategoryId));
    }
}
