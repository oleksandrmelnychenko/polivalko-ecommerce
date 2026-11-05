using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Persistence;

internal sealed class ProductLabelSet
{
    private readonly IReadOnlyList<ProductLabel> _labels;
    private readonly ILookup<Guid, Guid> _links;
    private readonly DateTimeOffset _now;

    private ProductLabelSet(IReadOnlyList<ProductLabel> labels, ILookup<Guid, Guid> links, DateTimeOffset now)
    {
        _labels = labels;
        _links = links;
        _now = now;
    }

    public static async Task<ProductLabelSet> LoadAsync(PoliValkoDbContext db, IReadOnlyCollection<Guid> productIds, DateTimeOffset now, CancellationToken ct)
    {
        var labels = await db.Set<ProductLabel>().AsNoTracking().Where(l => l.IsActive).OrderBy(l => l.SortOrder).ThenBy(l => l.Name).ToListAsync(ct);
        var manual = labels.Where(l => l.Kind == LabelKind.Manual).Select(l => l.Id).ToList();
        var links = productIds.Count == 0 || manual.Count == 0
            ? []
            : await db.Set<ProductLabelLink>().AsNoTracking()
                .Where(l => productIds.Contains(l.ProductId) && manual.Contains(l.LabelId))
                .ToListAsync(ct);
        return new ProductLabelSet(labels, links.ToLookup(l => l.ProductId, l => l.LabelId), now);
    }

    public IReadOnlyList<ProductLabel> For(Guid productId, decimal amount, decimal? oldAmount, DateTimeOffset createdAt)
    {
        if (_labels.Count == 0)
        {
            return [];
        }

        var linked = _links[productId].ToHashSet();
        return _labels.Where(l => l.AppliesTo(amount, oldAmount, createdAt, linked.Contains(l.Id), _now)).ToList();
    }
}
