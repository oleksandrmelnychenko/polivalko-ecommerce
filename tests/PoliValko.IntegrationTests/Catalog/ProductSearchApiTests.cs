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

    [Theory]
    [InlineData("'")]
    [InlineData("’")]
    [InlineData("'' ?")]
    public async Task A_query_of_punctuation_alone_finds_nothing_instead_of_the_whole_catalog(string q)
    {
        await api.AddProductAsync("vse-dlia-polyvu", "Лійка для апострофа", 100m);

        var found = await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={Uri.EscapeDataString(q)}", TestJson.Options, Ct);

        found!.TotalItems.ShouldBe(0);
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

    [Fact]
    public async Task Name_matches_come_before_section_matches_and_both_are_found()
    {
        var token = Token();
        var bySection = await api.AddProductAsync("vse-dlia-polyvu", $"Конектор {token}", 50m, stock: 20);
        var byName = await api.AddProductAsync("ruchnyi-instrument", $"Лійка поливальна {token}", 120m, stock: 0);

        var page = await SearchAsync($"полив {token}");

        // Out of stock, the name match still leads: the words come before stock and season.
        page.Items.Select(p => p.Id).ShouldBe([byName.Id, bySection.Id]);
        page.Approximate.ShouldBeFalse();
    }

    [Fact]
    public async Task Russian_words_and_the_wrong_keyboard_layout_find_the_product()
    {
        var token = Digits();
        var product = await api.AddProductAsync("ruchnyi-instrument", $"Граблі віялові {token}", 300m);

        (await SearchAsync($"грабли {token}")).Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
        (await SearchAsync($"uhf,ks {token}")).Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
    }

    [Fact]
    public async Task An_extra_unknown_word_does_not_empty_the_result()
    {
        var token = Digits();
        var product = await api.AddProductAsync("ruchnyi-instrument", $"Сапка садова {token}", 200m);

        var page = await SearchAsync($"сапка {token} найдешевша");

        page.Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
        page.Approximate.ShouldBeTrue();
    }

    private static string Token() => Guid.NewGuid().ToString("N")[..8];

    /// <summary>A token that stays itself on either keyboard layout.</summary>
    private static string Digits() => Random.Shared.NextInt64(10_000_000, 99_999_999).ToString(System.Globalization.CultureInfo.InvariantCulture);

    private async Task<ProductSearchResponse> SearchAsync(string q) =>
        (await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={Uri.EscapeDataString(q)}", TestJson.Options, Ct))!;
}
