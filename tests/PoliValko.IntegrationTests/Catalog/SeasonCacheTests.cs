using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.IntegrationTests;

// The storefront keeps two costly answers in memory: which seasonal rules name each product, and what three years of
// receipts say. Both must be computed once for many requests, and the rules again as soon as the catalog changes.
// The sections are hidden and passed in directly, so the shop the other tests look at gains nothing.
public sealed class SeasonCacheTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;
    private static readonly DateOnly January = new(2034, 1, 15);

    [Fact]
    public async Task Rules_are_matched_once_and_again_as_soon_as_the_catalog_changes()
    {
        var tools = await AddSectionAsync("Ручний інструмент");
        var pots = await AddSectionAsync("Горщики");
        var shovel = await api.AddProductAsync(tools.Slug, "Лопата штикова", 100);
        var bucket = await api.AddProductAsync(tools.Slug, "Відро", 100);
        Category[] sections = [tools];

        var first = await LookAsync(sections);
        first.InSeason.ShouldBeEmpty();
        // Nothing changed, so the answer is the one already in memory.
        (await LookAsync(sections)).Matches.ShouldBeSameAs(first.Matches);
        // The same catalog seen through another list of sections is another question.
        (await LookAsync([tools, pots])).Matches.ShouldNotBeSameAs(first.Matches);

        // A new name.
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == shovel.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.Name, "Лопата для снігу"), Ct));
        (await LookAsync(sections)).InSeason.ShouldBe([shovel.Id]);
        // A name shown on the site instead of the one from the till.
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == shovel.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.DisplayName, "Лопата штикова"), Ct));
        (await LookAsync(sections)).InSeason.ShouldBeEmpty();
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == shovel.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.DisplayName, (string?)null), Ct));
        // An attribute alone.
        await api.WithDbAsync(db =>
        {
            db.Add(new ProductAttribute { Id = Guid.NewGuid(), ProductId = bucket.Id, Name = "Призначення", Value = "Для снігу" });
            return db.SaveChangesAsync(Ct);
        });
        (await LookAsync(sections)).InSeason.Order().ShouldBe(new[] { shovel.Id, bucket.Id }.Order());
        await api.WithDbAsync(db => db.Set<ProductAttribute>().Where(a => a.ProductId == bucket.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(a => a.Value, "Для води"), Ct));
        (await LookAsync(sections)).InSeason.ShouldBe([shovel.Id]);
        // Another section.
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == shovel.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.CategoryId, pots.Id), Ct));
        (await LookAsync(sections)).InSeason.ShouldBeEmpty();
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == shovel.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.CategoryId, tools.Id), Ct));
        (await LookAsync(sections)).InSeason.ShouldBe([shovel.Id]);
        // Taken off the site.
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == shovel.Id)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.IsVisible, false), Ct));
        (await LookAsync(sections)).InSeason.ShouldBeEmpty();
    }

    [Fact]
    public async Task Requests_that_arrive_together_share_one_computation()
    {
        var tools = await AddSectionAsync("Ручний інструмент");
        await api.AddProductAsync(tools.Slug, "Лопата для снігу", 100);
        Category[] sections = [tools];

        var rules = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => api.WithScopeAsync(services =>
            SeasonalPurpose.LoadAsync(services.GetRequiredService<PoliValkoDbContext>(),
                services.GetRequiredService<IMemoryCache>(), sections, Ct))));
        rules.ShouldAllBe(answer => ReferenceEquals(answer, rules[0]));

        // A pair of dates no other test asks about.
        var today = new DateOnly(2061, 3, 3);
        var history = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => api.WithScopeAsync(services =>
            SeasonalHistory.LoadAsync(services.GetRequiredService<PoliValkoDbContext>(),
                services.GetRequiredService<IMemoryCache>(), today, today, Ct))));
        history.ShouldAllBe(answer => ReferenceEquals(answer, history[0]));
    }

    private Task<(object Matches, Guid[] InSeason)> LookAsync(Category[] sections) => api.WithScopeAsync(async services =>
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var matches = await SeasonalPurpose.LoadAsync(db, services.GetRequiredService<IMemoryCache>(), sections, Ct);
        var inSeason = await SeasonalPurpose.Query(db, matches, sections, January).Rows.Select(match => match.ProductId).ToArrayAsync(Ct);
        return ((object)matches, inSeason);
    });

    private async Task<Category> AddSectionAsync(string name)
    {
        var section = new Category { Id = Guid.NewGuid(), Slug = "cache-" + Guid.NewGuid(), Name = name, IsVisible = false };
        await api.WithDbAsync(db => { db.Add(section); return db.SaveChangesAsync(Ct); });
        return section;
    }
}
