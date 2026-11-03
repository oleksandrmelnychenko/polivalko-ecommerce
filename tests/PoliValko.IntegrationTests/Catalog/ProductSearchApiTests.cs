using System.Net.Http.Json;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.IntegrationTests;

public sealed class ProductSearchApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Theory]
    [InlineData("шланги")]
    [InlineData("шлангу")]
    [InlineData("ШЛАНГАМИ")]
    public async Task Plural_and_case_forms_find_the_product(string word)
    {
        var token = Token();
        var product = await api.AddProductAsync("vse-dlia-polyvu", $"Шланг садовий {token}", 300m);

        var page = await SearchAsync($"{word} {token}");

        page.Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
        page.Approximate.ShouldBeFalse();
    }

    [Fact]
    public async Task Words_match_in_any_order()
    {
        var token = Token();
        var product = await api.AddProductAsync("vse-dlia-polyvu", $"Шланг садовий {token}", 300m);

        var page = await SearchAsync($"{token} садові шланги");

        page.Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
    }

    [Fact]
    public async Task Latin_query_matches_transliterated_slug()
    {
        var token = Token();
        var product = await api.AddProductAsync("ruchnyi-instrument", $"Лопата штикова {token}", 450m, slug: $"lopata-shtykova-{token}");

        var page = await SearchAsync($"lopata {token}");

        page.Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
        page.Approximate.ShouldBeFalse();
    }

    [Fact]
    public async Task Typo_falls_back_to_similar_products()
    {
        var token = Token();
        var product = await api.AddProductAsync("ruchnyi-instrument", $"Секатор площинний {token}", 520m);

        var page = await SearchAsync($"секатри {token}");

        page.Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
        page.Approximate.ShouldBeTrue();
    }

    [Fact]
    public async Task Latin_brand_typed_in_cyrillic_is_found_through_the_slug()
    {
        var token = Token();
        var product = await api.AddProductAsync(
            "tekhnika-dlia-sadu-ta-horodu",
            $"Газонокосарка Viking {token}",
            15000m,
            brand: "Viking",
            slug: $"hazonokosarka-viking-{token}");

        var page = await SearchAsync($"вікінг {token}");

        page.Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
        page.Approximate.ShouldBeTrue();
    }

    [Fact]
    public async Task Nonsense_finds_nothing_and_is_not_marked_approximate()
    {
        var page = await SearchAsync("жжжффф");

        page.TotalItems.ShouldBe(0);
        page.Approximate.ShouldBeFalse();
    }

    private static string Token() => Guid.NewGuid().ToString("N")[..8];

    private async Task<ProductSearchResponse> SearchAsync(string q) =>
        (await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={Uri.EscapeDataString(q)}", Ct))!;
}
