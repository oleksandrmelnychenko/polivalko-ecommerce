using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.IntegrationTests;

public sealed class PlantCoverSeasonTests(ApiFactory api)
{
    [Fact]
    public async Task Frost_protection_and_shade_nets_take_turns_in_the_catalog_and_category()
    {
        var ct = TestContext.Current.CancellationToken;
        var root = await api.WithDbAsync(db => db.Set<Category>().SingleAsync(c => c.Slug == "ruchnyi-instrument", ct));
        var cover = new Category { Id = Guid.NewGuid(), Name = "Укривні матеріали", Slug = "cover-" + Guid.NewGuid(), ParentId = root.Id };
        var child = new Category { Id = Guid.NewGuid(), Name = "Текстиль", Slug = "cloth-" + Guid.NewGuid(), ParentId = cover.Id };
        await api.WithDbAsync(db => { db.AddRange(cover, child); return db.SaveChangesAsync(ct); });
        var frost = await api.AddProductAsync(cover.Slug, "Чохол для садових рослин", 100);
        var fleece = await api.AddProductAsync(child.Slug, "Біле агроволокно 4 м", 100);
        var shade = await api.AddProductAsync(child.Slug, "Сітка затіняюча 65%", 100);
        var clips = await api.AddProductAsync(child.Slug, "Кліпси для затінювальної сітки", 20);
        var mulch = await api.AddProductAsync(cover.Slug, "Агроволокно чорне", 100);
        var soldOut = await api.AddProductAsync(cover.Slug, "Чохол для троянд", 100, stock: 0);
        var ids = new[] { frost.Id, fleece.Id, shade.Id, clips.Id, mulch.Id, soldOut.Id };
        await api.WithScopeAsync(async services =>
        {
            var db = services.GetRequiredService<PoliValkoDbContext>();
            var merchandising = services.GetRequiredService<SeasonalMerchandising>();
            var categories = await CategoryQueries.LoadVisibleCategoriesAsync(db, ct);
            foreach (var across in new[] { true, false })
            {
                foreach (var month in new[] { 1, 4, 5, 8, 9, 11 })
                {
                    var ranked = await merchandising.SortAsync(db.Set<Product>().Where(p => ids.Contains(p.Id)),
                        categories, null, db, new DateOnly(2032, month, 15), ct, acrossCategories: across);
                    var order = await ranked.Select(p => p.Id).ToArrayAsync(ct);
                    if (month is >= 5 and <= 8) order[0].ShouldBe(shade.Id);
                    else order[..2].Order().ShouldBe(new[] { frost.Id, fleece.Id }.Order());
                    order.Order().ShouldBe(ids.Order());
                    order[^1].ShouldBe(soldOut.Id);
                }
            }
            return true;
        });
    }
}
