using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

/// <summary>
/// Товар із ціною 0 (з DNTrade без роздрібної ціни) не можна замовити — CheckoutCalculator його відхиляє.
/// Вітрина не має показувати його як «В наявності», навіть коли залишок є.
/// </summary>
public sealed class ProductWithoutPriceTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Product_with_zero_price_and_stock_is_not_in_stock_on_card_listing_filter_and_facets()
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        var priced = await api.AddProductAsync("novyi-rik", $"Ялинка {token} з ціною", 2500m, stock: 4);
        var unpriced = await api.AddProductAsync("novyi-rik", $"Ялинка {token} без ціни", 0m, stock: 6);

        var details = await _client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{unpriced.Slug}", TestJson.Options, Ct);
        details!.Price.ShouldBe(new MoneyDto("0.00", "UAH"));
        details.InStock.ShouldBeFalse();
        (await _client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{priced.Slug}", TestJson.Options, Ct))!.InStock.ShouldBeTrue();

        var all = await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={token}", TestJson.Options, Ct);
        all!.TotalItems.ShouldBe(2);
        all.Items.Single(p => p.Id == unpriced.Id).InStock.ShouldBeFalse();
        all.Items.Single(p => p.Id == priced.Id).InStock.ShouldBeTrue();
        all.Facets.InStockCount.ShouldBe(1);

        var inStock = await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={token}&inStock=true", TestJson.Options, Ct);
        inStock!.Items.ShouldHaveSingleItem().Id.ShouldBe(priced.Id);
        inStock.TotalItems.ShouldBe(1);
    }

    [Fact]
    public async Task Variant_without_price_is_not_offered_as_in_stock()
    {
        var group = $"group-{Guid.NewGuid():N}";
        var priced = await api.AddProductAsync("novyi-rik", "Ялинка 180 см", 1800m, stock: 2);
        var unpriced = await api.AddProductAsync("novyi-rik", "Ялинка 210 см", 0m, stock: 2);
        foreach (var (id, label) in new[] { (priced.Id, "180 см"), (unpriced.Id, "210 см") })
        {
            await api.WithDbAsync(db => db.Set<Product>().Where(p => p.Id == id).ExecuteUpdateAsync(
                s => s.SetProperty(p => p.VariantGroup, group).SetProperty(p => p.VariantLabel, label), Ct));
        }

        var details = await _client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{priced.Slug}", TestJson.Options, Ct);

        details!.Variants.Single(v => v.Slug == priced.Slug).InStock.ShouldBeTrue();
        details.Variants.Single(v => v.Slug == unpriced.Slug).InStock.ShouldBeFalse();
    }
}
