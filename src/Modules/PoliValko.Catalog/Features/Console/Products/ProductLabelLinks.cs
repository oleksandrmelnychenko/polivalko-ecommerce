using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console.Products;

internal static class ProductLabelLinks
{
    public static async Task ReplaceAsync(PoliValkoDbContext db, Guid productId, IReadOnlyCollection<Guid> labelIds, CancellationToken ct)
    {
        var current = await db.Set<ProductLabelLink>().Where(l => l.ProductId == productId).ToListAsync(ct);
        db.RemoveRange(current.Where(l => !labelIds.Contains(l.LabelId)));
        var have = current.Select(l => l.LabelId).ToHashSet();
        db.AddRange(labelIds.Where(id => !have.Contains(id)).Select(id => new ProductLabelLink { ProductId = productId, LabelId = id }));
    }
}
