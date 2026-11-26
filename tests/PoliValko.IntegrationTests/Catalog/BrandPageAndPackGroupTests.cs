using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.IntegrationTests;

public sealed class BrandPageAndPackGroupTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<Brand> AddBrandAsync(string name, string slug, int withPhoto, int withoutPhoto = 0, string? otherSpelling = null)
    {
        var products = new List<Product>();
        for (var i = 0; i < withPhoto + withoutPhoto; i++)
        {
            var spelling = otherSpelling is not null && i == 0 ? otherSpelling : name;
            products.Add(await api.AddProductAsync("vse-dlia-polyvu", $"Товар {name} {i}", 100m + i, brand: spelling));
        }

        return await api.WithDbAsync(async db =>
        {
            foreach (var product in products.Take(withPhoto))
            {
                db.Add(new ProductImage { Id = Guid.CreateVersion7(), ProductId = product.Id, Url = $"https://example.test/{product.Slug}.jpg", Alt = name });
            }

            var brand = new Brand { Id = Guid.CreateVersion7(), Slug = slug, Description = $"Про {name}" };
            brand.Rename(name);
            db.Add(brand);
            await db.SaveChangesAsync(Ct);
            return brand;
        });
    }

    [Fact]
    public async Task A_brand_with_five_products_with_a_photo_gets_a_page_with_all_its_products()
    {
        var marker = Guid.NewGuid().ToString("N")[..6];
        var name = $"Brandpage{marker}";
        var brand = await AddBrandAsync(name, $"brandpage-{marker}", withPhoto: 5, withoutPhoto: 1, otherSpelling: name.ToUpperInvariant());
        var client = api.CreateClient();

        var page = await client.GetFromJsonAsync<BrandPageDto>($"/api/v1/catalog/brands/{brand.Slug}", TestJson.Options, Ct);
        page!.Name.ShouldBe(name);
        page.Description.ShouldBe($"Про {name}");
        // Every visible product counts, with or without a photo, in any spelling of the brand.
        page.ProductCount.ShouldBe(6);

        var products = await client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?brandPage={brand.Slug}&pageSize=48", TestJson.Options, Ct);
        products!.TotalItems.ShouldBe(6);
        products.Items.ShouldAllBe(i => i.Brand!.Equals(name, StringComparison.OrdinalIgnoreCase));

        var list = await client.GetFromJsonAsync<List<BrandSummaryDto>>("/api/v1/catalog/brands", TestJson.Options, Ct);
        list!.ShouldContain(b => b.Slug == brand.Slug && b.ProductCount == 6);

        var sitemap = await client.GetFromJsonAsync<SitemapDto>("/api/v1/catalog/sitemap", TestJson.Options, Ct);
        sitemap!.Brands.ShouldContain(b => b.Slug == brand.Slug);

        // A product links to its brand page.
        var details = await client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{products.Items[0].Slug}", TestJson.Options, Ct);
        details!.BrandSlug.ShouldBe(brand.Slug);
    }

    [Fact]
    public async Task A_brand_with_fewer_than_five_products_with_a_photo_has_no_page_anywhere()
    {
        var marker = Guid.NewGuid().ToString("N")[..6];
        var brand = await AddBrandAsync($"Smallbrand{marker}", $"smallbrand-{marker}", withPhoto: 4, withoutPhoto: 3);
        var client = api.CreateClient();

        (await client.GetAsync($"/api/v1/catalog/brands/{brand.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await client.GetAsync($"/api/v1/products?brandPage={brand.Slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await client.GetFromJsonAsync<List<BrandSummaryDto>>("/api/v1/catalog/brands", TestJson.Options, Ct))!.ShouldNotContain(b => b.Slug == brand.Slug);
        (await client.GetFromJsonAsync<SitemapDto>("/api/v1/catalog/sitemap", TestJson.Options, Ct))!.Brands.ShouldNotContain(b => b.Slug == brand.Slug);

        var products = await client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?brand={brand.Name}", TestJson.Options, Ct);
        var details = await client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{products!.Items[0].Slug}", TestJson.Options, Ct);
        details!.BrandSlug.ShouldBeNull();
    }

    private async Task<List<Product>> AddPackGroupAsync(string marker, params (string Label, decimal Price, decimal Stock)[] sizes)
    {
        var products = new List<Product>();
        foreach (var (label, price, stock) in sizes)
        {
            products.Add(await api.AddProductAsync("vse-dlia-polyvu", $"Насіння фасування {marker} {label}", price, stock: stock));
        }

        await api.WithDbAsync(async db =>
        {
            foreach (var (product, (label, _, _)) in products.Zip(sizes))
            {
                await db.Set<Product>().Where(p => p.Id == product.Id).ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.VariantGroup, $"pack-{marker}")
                    .SetProperty(p => p.VariantLabel, label), Ct);
            }

            return 0;
        });
        return products;
    }

    [Fact]
    public async Task A_listing_shows_a_pack_group_as_one_card_the_cheapest_that_can_be_bought()
    {
        var marker = Guid.NewGuid().ToString("N")[..6];
        var group = await AddPackGroupAsync(marker, ("0,5 г", 12m, 0m), ("2 г", 25m, 3m), ("10 г", 90m, 3m));

        var page = await api.CreateClient().GetFromJsonAsync<ProductSearchResponse>(
            $"/api/v1/products?q={Uri.EscapeDataString($"фасування {marker}")}&pageSize=48", TestJson.Options, Ct);

        // The cheapest size is sold out, so the card is the cheapest one in stock.
        page!.TotalItems.ShouldBe(1);
        var card = page.Items.ShouldHaveSingleItem();
        card.Id.ShouldBe(group[1].Id);
        card.PackSizes.ShouldBe(3);
        card.PriceFrom!.Value.ShouldBe("12.00");
    }

    [Fact]
    public async Task A_filter_that_matches_one_pack_size_still_finds_it()
    {
        var marker = Guid.NewGuid().ToString("N")[..6];
        var group = await AddPackGroupAsync(marker, ("0,5 г", 12m, 3m), ("10 г", 90m, 3m));
        var client = api.CreateClient();
        var q = Uri.EscapeDataString($"фасування {marker}");

        var expensive = await client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={q}&priceMin=50", TestJson.Options, Ct);
        expensive!.Items.ShouldHaveSingleItem().Id.ShouldBe(group[1].Id);

        var both = await client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={q}", TestJson.Options, Ct);
        both!.Items.ShouldHaveSingleItem().Id.ShouldBe(group[0].Id);

        // The product page still switches between both sizes.
        var details = await client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{group[1].Slug}", TestJson.Options, Ct);
        details!.Variants.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Pack_sizes_at_one_price_show_no_price_from()
    {
        var marker = Guid.NewGuid().ToString("N")[..6];
        await AddPackGroupAsync(marker, ("червоний", 40m, 3m), ("жовтий", 40m, 3m));

        var page = await api.CreateClient().GetFromJsonAsync<ProductSearchResponse>(
            $"/api/v1/products?q={Uri.EscapeDataString($"фасування {marker}")}", TestJson.Options, Ct);

        var card = page!.Items.ShouldHaveSingleItem();
        card.PackSizes.ShouldBe(2);
        card.PriceFrom.ShouldBeNull();
    }
}
