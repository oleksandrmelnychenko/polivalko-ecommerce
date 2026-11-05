using System.Net;
using System.Net.Http.Json;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class CatalogApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Top_level_categories_match_navkolo_groups()
    {
        var tree = await _client.GetFromJsonAsync<List<CategoryNodeDto>>("/api/v1/categories", Ct);

        tree!.Select(c => c.Name).ShouldBe(
        [
            "Все для відпочинку",
            "Все для поливу",
            "Все для рослин",
            "Господарчі товари",
            "Ландшафтний дизайн",
            "Новий рік",
            "Ручний інструмент",
            "Техніка для саду та городу",
        ]);
    }

    [Fact]
    public async Task Products_are_filtered_sorted_by_price_and_paginated_on_server()
    {
        var token = Guid.NewGuid().ToString("N")[..8];
        await api.AddProductAsync("vse-dlia-polyvu", $"Шланг {token} А", 300m);
        await api.AddProductAsync("vse-dlia-polyvu", $"Шланг {token} Б", 100m);
        await api.AddProductAsync("vse-dlia-polyvu", $"Шланг {token} В", 200m, stock: 0);
        await api.AddProductAsync("ruchnyi-instrument", $"Шланг {token} інша категорія", 50m);

        var page = await _client.GetFromJsonAsync<ProductSearchResponse>(
            $"/api/v1/products?q={token}&category=vse-dlia-polyvu&sort=price_desc&page=2&pageSize=2",
            TestJson.Options,
            Ct);

        page!.TotalItems.ShouldBe(3);
        page.TotalPages.ShouldBe(2);
        page.Items.Single().Price.ShouldBe(new MoneyDto("100.00", "UAH"));

        var inStock = await _client.GetFromJsonAsync<ProductSearchResponse>(
            $"/api/v1/products?q={token}&category=vse-dlia-polyvu&inStock=true",
            TestJson.Options,
            Ct);
        inStock!.Items.ShouldAllBe(p => p.InStock);
        inStock.TotalItems.ShouldBe(2);
    }

    [Fact]
    public async Task Product_is_found_by_exact_sku()
    {
        var product = await api.AddProductAsync("vse-dlia-roslyn", "Ґрунт для розсади", 120m);

        var page = await _client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={product.Sku}", TestJson.Options, Ct);

        page!.Items.ShouldHaveSingleItem().Id.ShouldBe(product.Id);
    }

    [Fact]
    public async Task Old_price_is_shown_only_when_it_is_higher_than_current()
    {
        var promo = await api.AddProductAsync("novyi-rik", "Гірлянда акційна", 300m, oldPrice: 400m);
        var broken = await api.AddProductAsync("novyi-rik", "Гірлянда з некоректною старою ціною", 300m, oldPrice: 250m);

        var promoDto = await _client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{promo.Slug}", TestJson.Options, Ct);
        var brokenDto = await _client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{broken.Slug}", TestJson.Options, Ct);

        promoDto!.OldPrice.ShouldBe(new MoneyDto("400.00", "UAH"));
        brokenDto!.OldPrice.ShouldBeNull();
        promoDto.Category.Slug.ShouldBe("novyi-rik");
    }

    [Fact]
    public async Task Hidden_product_returns_problem_with_code()
    {
        var hidden = await api.AddProductAsync("hospodarchi-tovary", "Прихований товар", 10m, visible: false);

        var response = await _client.GetAsync($"/api/v1/products/{hidden.Slug}", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("catalog.product_not_found");
    }

    [Fact]
    public async Task Invalid_sort_returns_validation_problem()
    {
        var response = await _client.GetAsync("/api/v1/products?sort=random", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>(Ct);
        problem!.Code.ShouldBe("validation.failed");
        problem.Errors!.ShouldContainKey("sort");
    }

    [Fact]
    public async Task Unknown_route_returns_problem_json()
    {
        var response = await _client.GetAsync("/api/v1/does-not-exist", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await response.Content.ReadFromJsonAsync<ProblemBody>(Ct);
        problem!.Code.ShouldBe("http.not_found");
        problem.TraceId.ShouldNotBeNullOrEmpty();
    }
}
