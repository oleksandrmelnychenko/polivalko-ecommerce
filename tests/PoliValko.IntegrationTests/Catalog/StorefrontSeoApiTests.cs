using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.IntegrationTests;

public sealed class StorefrontSeoApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Sitemap_leaves_out_products_without_a_price_or_out_of_stock_without_a_photo()
    {
        var marker = Guid.NewGuid().ToString("N")[..6];
        var inStock = await api.AddProductAsync("hospodarchi-tovary", $"Відро в наявності {marker}", 120m, stock: 3);
        var noPrice = await api.AddProductAsync("hospodarchi-tovary", $"Відро без ціни {marker}", 0m, stock: 3);
        var gone = await api.AddProductAsync("hospodarchi-tovary", $"Відро без фото {marker}", 120m, stock: 0);

        var sitemap = await api.CreateClient().GetStringAsync("/api/v1/catalog/sitemap", Ct);

        sitemap.ShouldContain(inStock.Slug);
        sitemap.ShouldNotContain(noPrice.Slug);
        sitemap.ShouldNotContain(gone.Slug);
        // The pages themselves stay reachable.
        (await api.CreateClient().GetAsync($"/api/v1/products/{gone.Slug}", Ct)).IsSuccessStatusCode.ShouldBeTrue();
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
