using System.Net.Http.Json;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class CatalogFacetsTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Brand_filter_narrows_items_while_facets_describe_the_whole_selection()
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        await api.AddProductAsync("vse-dlia-roslyn", $"Добриво {token} перше", 100m, oldPrice: 150m, brand: "Florovit");
        await api.AddProductAsync("vse-dlia-roslyn", $"Добриво {token} друге", 200m, brand: "Florovit");
        await api.AddProductAsync("vse-dlia-roslyn", $"Добриво {token} третє", 300m, stock: 0, brand: "Agrecol");

        var filtered = await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={token}&brand=Florovit", TestJson.Options, Ct);

        filtered!.TotalItems.ShouldBe(2);
        filtered.Facets.Brands.ShouldBe([new BrandFacet("Florovit", 2), new BrandFacet("Agrecol", 1)]);
        filtered.Facets.PriceMin.ShouldBe(new MoneyDto("100.00", "UAH"));
        filtered.Facets.PriceMax.ShouldBe(new MoneyDto("300.00", "UAH"));
        filtered.Facets.InStockCount.ShouldBe(2);

        var onSale = await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={token}&onSale=true", TestJson.Options, Ct);
        onSale!.Items.ShouldHaveSingleItem().OldPrice.ShouldBe(new MoneyDto("150.00", "UAH"));
        onSale.Facets.Brands.ShouldBe([new BrandFacet("Florovit", 1)]);
        onSale.Facets.PriceMax.ShouldBe(new MoneyDto("100.00", "UAH"));
        onSale.Facets.InStockCount.ShouldBe(1);
    }

    [Fact]
    public async Task Images_are_returned_in_list_details_and_photo_credits()
    {
        var product = await api.AddProductAsync("novyi-rik", "Гірлянда з фото", 359m);
        var credit = $"Автор {Guid.NewGuid():N}, CC BY-SA 4.0, Wikimedia Commons";
        await api.WithDbAsync(async db =>
        {
            db.Add(new ProductImage { Id = Guid.CreateVersion7(), ProductId = product.Id, Url = "https://example.test/second.jpg", Alt = "Друге фото", SortOrder = 1 });
            db.Add(new ProductImage { Id = Guid.CreateVersion7(), ProductId = product.Id, Url = "https://example.test/first.jpg", Alt = "Гірлянда", SortOrder = 0, Credit = credit });
            return await db.SaveChangesAsync(Ct);
        });

        var details = await _client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{product.Slug}", TestJson.Options, Ct);
        details!.Images.Select(i => i.Url).ShouldBe(["https://example.test/first.jpg", "https://example.test/second.jpg"]);

        var list = await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={product.Sku}", TestJson.Options, Ct);
        list!.Items.ShouldHaveSingleItem().ImageUrl.ShouldBe("https://example.test/first.jpg");

        var credits = await _client.GetFromJsonAsync<List<PhotoCreditDto>>("/api/v1/catalog/photo-credits", Ct);
        credits!.ShouldContain(new PhotoCreditDto(credit, "https://example.test/first.jpg"));
    }
}
