using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.SharedKernel;

namespace PoliValko.Catalog.Persistence;

internal static class CatalogDictionarySync
{
    public static async Task SyncAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        await SyncAttributesAsync(db, ct);
        await SyncBrandsAsync(db, ct);
        await SeedLabelsAsync(db, ct);
    }

    public static async Task SyncAttributesAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var definitions = await db.Set<AttributeDefinition>().AsNoTracking().Select(d => new { d.NormalizedName, d.Aliases, d.SortOrder }).ToListAsync(ct);
        var known = definitions.Select(d => d.NormalizedName)
            .Concat(definitions.SelectMany(d => d.Aliases).Select(AttributeDefinition.Normalize))
            .ToHashSet(StringComparer.Ordinal);
        var productNames = await db.Set<ProductAttribute>().Select(a => a.Name).Distinct().ToListAsync(ct);
        var filterNames = (await db.Set<Category>().Where(c => c.FilterAttributes != null).Select(c => c.FilterAttributes!).ToListAsync(ct))
            .SelectMany(f => f);
        var order = definitions.Count == 0 ? 0 : definitions.Max(d => d.SortOrder) + 1;
        var added = new List<AttributeDefinition>();
        foreach (var name in filterNames.Concat(productNames.Order(StringComparer.Ordinal)))
        {
            var clean = name.Trim();
            if (clean.Length is 0 or > AttributeDefinition.MaxNameLength || !known.Add(AttributeDefinition.Normalize(clean)))
            {
                continue;
            }

            var definition = new AttributeDefinition { Id = Guid.CreateVersion7(), Kind = AttributeKind.List, FilterView = AttributeFilterView.Checkboxes, SortOrder = order++ };
            definition.Rename(clean);
            added.Add(definition);
        }

        await AddAsync(db, added, ct);
    }

    public static async Task AddMissingAttributesAsync(PoliValkoDbContext db, IReadOnlyCollection<string> names, CancellationToken ct)
    {
        var wanted = names.Select(n => n.Trim()).Where(n => n.Length is > 0 and <= AttributeDefinition.MaxNameLength)
            .DistinctBy(AttributeDefinition.Normalize).ToList();
        if (wanted.Count == 0)
        {
            return;
        }

        var definitions = await db.Set<AttributeDefinition>().AsNoTracking().Select(d => new { d.NormalizedName, d.Aliases, d.SortOrder }).ToListAsync(ct);
        var known = definitions.Select(d => d.NormalizedName)
            .Concat(definitions.SelectMany(d => d.Aliases).Select(AttributeDefinition.Normalize))
            .ToHashSet(StringComparer.Ordinal);
        var order = definitions.Count == 0 ? 0 : definitions.Max(d => d.SortOrder) + 1;
        foreach (var name in wanted.Where(n => known.Add(AttributeDefinition.Normalize(n))))
        {
            var definition = new AttributeDefinition { Id = Guid.CreateVersion7(), Kind = AttributeKind.List, FilterView = AttributeFilterView.Checkboxes, SortOrder = order++ };
            definition.Rename(name);
            db.Add(definition);
        }
    }

    public static async Task SyncBrandsAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        var brands = await db.Set<Brand>().AsNoTracking().Select(b => new { b.NormalizedName, b.Slug }).ToListAsync(ct);
        var known = brands.Select(b => b.NormalizedName).ToHashSet(StringComparer.Ordinal);
        var slugs = brands.Select(b => b.Slug).ToHashSet(StringComparer.Ordinal);
        var names = await db.Set<Product>().Where(p => p.Brand != null).Select(p => p.Brand!).Distinct().ToListAsync(ct);
        var added = new List<Brand>();
        foreach (var name in names.Order(StringComparer.Ordinal))
        {
            var clean = name.Trim();
            if (clean.Length is 0 or > Brand.MaxNameLength || !known.Add(Brand.Normalize(clean)))
            {
                continue;
            }

            var brand = new Brand { Id = Guid.CreateVersion7(), Slug = UniqueSlug(clean, slugs) };
            brand.Rename(clean);
            added.Add(brand);
        }

        await AddAsync(db, added, ct);
    }

    public static string UniqueSlug(string name, ISet<string> taken)
    {
        var baseSlug = Transliteration.ToSlug(name) is { Length: > 0 } slug ? slug[..Math.Min(slug.Length, 180)].Trim('-') : "brand";
        if (baseSlug.Length == 0)
        {
            baseSlug = "brand";
        }

        var candidate = baseSlug;
        for (var i = 2; !taken.Add(candidate); i++)
        {
            candidate = $"{baseSlug}-{i}";
        }

        return candidate;
    }

    private static async Task SeedLabelsAsync(PoliValkoDbContext db, CancellationToken ct)
    {
        if (await db.Set<ProductLabel>().AnyAsync(ct))
        {
            return;
        }

        await AddAsync(
            db,
            [
                new ProductLabel { Id = Guid.CreateVersion7(), Name = "Акція", Kind = LabelKind.Sale, Tone = LabelTone.Red, SortOrder = 0 },
                new ProductLabel { Id = Guid.CreateVersion7(), Name = "Новинка", Kind = LabelKind.New, Tone = LabelTone.Green, NewDays = 30, SortOrder = 1 },
                new ProductLabel { Id = Guid.CreateVersion7(), Name = "Хіт", Kind = LabelKind.Manual, Tone = LabelTone.Orange, SortOrder = 2 },
            ],
            ct);
    }

    private static async Task AddAsync<T>(PoliValkoDbContext db, IReadOnlyList<T> entities, CancellationToken ct)
        where T : class
    {
        if (entities.Count == 0)
        {
            return;
        }

        var entries = new List<EntityEntry<T>>();
        foreach (var entity in entities)
        {
            entries.Add(db.Add(entity));
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            foreach (var entry in entries)
            {
                entry.State = EntityState.Detached;
            }
        }
    }
}
