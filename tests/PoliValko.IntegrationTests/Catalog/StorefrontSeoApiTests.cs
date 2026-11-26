using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.IntegrationTests;

public sealed class StorefrontSeoApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Sitemap_lists_the_products_that_have_a_photo()
    {
        var marker = Guid.NewGuid().ToString("N")[..6];
        var soldOutWithPhoto = await api.AddProductAsync("hospodarchi-tovary", $"Відро з фото {marker}", 120m, stock: 0);
        var inStockNoPhoto = await api.AddProductAsync("hospodarchi-tovary", $"Відро без фото {marker}", 120m, stock: 3);
        var noPriceWithPhoto = await api.AddProductAsync("hospodarchi-tovary", $"Відро без ціни {marker}", 0m, stock: 3);
        await api.WithDbAsync(async db =>
        {
            foreach (var product in new[] { soldOutWithPhoto, noPriceWithPhoto })
            {
                db.Add(new ProductImage { Id = Guid.CreateVersion7(), ProductId = product.Id, Url = $"https://example.test/{product.Slug}.jpg", Alt = "Відро" });
            }

            return await db.SaveChangesAsync(Ct);
        });

        var sitemap = await api.CreateClient().GetStringAsync("/api/v1/catalog/sitemap", Ct);

        // A photo is enough, whatever the stock or the price: the page shows the product even when it cannot be bought.
        sitemap.ShouldContain(soldOutWithPhoto.Slug);
        sitemap.ShouldContain(noPriceWithPhoto.Slug);
        // Shown on the site, but not offered to search engines until it has a photo.
        sitemap.ShouldNotContain(inStockNoPhoto.Slug);
        // The pages themselves stay reachable.
        (await api.CreateClient().GetAsync($"/api/v1/products/{inStockNoPhoto.Slug}", Ct)).IsSuccessStatusCode.ShouldBeTrue();
    }

    [Fact]
    public async Task Sitemap_dates_a_category_by_the_latest_change_among_its_own_products()
    {
        var marker = Guid.NewGuid().ToString("N")[..6];
        var hose = await api.AddProductAsync("vse-dlia-polyvu", $"Шланг із датою {marker}", 120m);
        var changed = new DateTimeOffset(2031, 3, 1, 10, 0, 0, TimeSpan.Zero);
        Task<int> SetChangedAsync(DateTimeOffset at) => api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == hose.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.UpdatedAt, at), Ct));
        await SetChangedAsync(changed);
        try
        {
            var sitemap = await api.CreateClient().GetFromJsonAsync<SitemapDto>("/api/v1/catalog/sitemap", TestJson.Options, Ct);

            // The product has no photo, so it is not listed itself, but the category page shows it.
            sitemap!.Categories.Single(c => c.Slug == "vse-dlia-polyvu").UpdatedAt.ShouldBe(changed);
            // A change in one department does not date another.
            sitemap.Categories.Single(c => c.Slug == "hospodarchi-tovary").UpdatedAt.ShouldBeLessThan(changed);
        }
        finally
        {
            // Other tests share the database: a date in the future would lead their «latest change» too.
            await SetChangedAsync(DateTimeOffset.UtcNow);
        }
    }

    [Fact]
    public async Task Product_meta_description_uses_its_own_text_when_there_is_enough_of_it()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Зрошувач з описом", 450m);
        const string text = "Металевий імпульсний зрошувач на кілку для поливу великих газонів, городу й саду. Сектор поливу налаштовується від 20° до 360°, а кілька зрошувачів з’єднуються в одну лінію.";
        await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == product.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.DescriptionHtml, $"<p>{text}</p>"), Ct));

        var details = await api.CreateClient().GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{product.Slug}", TestJson.Options, Ct);

        details!.SeoDescription.ShouldBe(SeoTemplates.DescriptionSnippet($"<p>{text}</p>"));
        details.SeoDescription!.ShouldStartWith("Металевий імпульсний зрошувач на кілку");
        details.SeoDescription.Length.ShouldBeLessThanOrEqualTo(SeoTemplates.SnippetMaxLength);
    }
}
