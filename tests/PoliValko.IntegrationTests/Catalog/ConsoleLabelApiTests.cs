using System.Net;
using System.Net.Http.Json;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Labels;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleLabelApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Seeded_labels_follow_their_rules_on_storefront_and_console()
    {
        var admin = await Staff.AdminAsync(api);
        var labels = await admin.ReadAsync<List<LabelDto>>(CatalogDictionaries.Labels);
        var sale = labels.Single(l => l.Name == "Акція");
        var fresh = labels.Single(l => l.Name == "Новинка");
        var hit = labels.Single(l => l.Name == "Хіт");
        (sale.Kind, sale.Tone).ShouldBe((LabelKind.Sale, LabelTone.Red));
        (fresh.Kind, fresh.Tone, fresh.NewDays).ShouldBe((LabelKind.New, LabelTone.Green, (int?)30));
        (hit.Kind, hit.Tone).ShouldBe((LabelKind.Manual, LabelTone.Orange));

        var discounted = await api.AddProductAsync("vse-dlia-polyvu", "Дощувач зі знижкою", 400m, oldPrice: 520m, createdAt: DateTimeOffset.UtcNow.AddDays(-90));
        var newcomer = await api.AddProductAsync("vse-dlia-polyvu", "Дощувач новинка", 400m);
        var plain = await api.AddProductAsync("vse-dlia-polyvu", "Дощувач звичайний", 400m, oldPrice: 300m, createdAt: DateTimeOffset.UtcNow.AddDays(-45));

        var client = api.CreateClient();
        (await StorefrontLabelsAsync(client, discounted)).ShouldBe([new ProductLabelBadgeDto("Акція", LabelTone.Red)]);
        (await StorefrontLabelsAsync(client, newcomer)).ShouldBe([new ProductLabelBadgeDto("Новинка", LabelTone.Green)]);
        (await StorefrontLabelsAsync(client, plain)).ShouldBeEmpty();
        var details = await client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{discounted.Slug}", TestJson.Options, Ct);
        details!.Labels.ShouldBe([new ProductLabelBadgeDto("Акція", LabelTone.Red)]);

        var hitProduct = await (await admin.PutAsJsonAsync(
                $"/api/v1/console/catalog/products/{newcomer.Id}",
                new UpdateProductRequest(null, null, null, null, null, true, null, null, null, [hit.Id]),
                TestJson.Options,
                Ct))
            .ReadAsync<ConsoleProductDto>();
        hitProduct.LabelIds.ShouldBe([hit.Id]);
        hitProduct.Labels.Select(l => l.Name).ShouldBe(["Новинка", "Хіт"]);
        hitProduct.CreatedAt.ShouldBe(newcomer.CreatedAt, TimeSpan.FromMilliseconds(1));
        (await StorefrontLabelsAsync(client, newcomer)).ShouldBe([new ProductLabelBadgeDto("Новинка", LabelTone.Green), new ProductLabelBadgeDto("Хіт", LabelTone.Orange)]);

        var row = (await admin.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"/api/v1/console/catalog/products?q={discounted.Sku}")).Items.ShouldHaveSingleItem();
        row.Labels.ShouldBe([new ConsoleProductLabelDto(sale.Id, "Акція", LabelTone.Red, LabelKind.Sale)]);

        var bySale = await admin.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"/api/v1/console/catalog/products?labelId={sale.Id}&pageSize=100&q=Дощувач");
        bySale.Items.Select(i => i.Id).ShouldContain(discounted.Id);
        bySale.Items.Select(i => i.Id).ShouldNotContain(plain.Id);
        var byHit = await admin.ReadAsync<PagedResponse<ConsoleProductListItemDto>>($"/api/v1/console/catalog/products?labelId={hit.Id}&q=Дощувач");
        byHit.Items.ShouldHaveSingleItem().Id.ShouldBe(newcomer.Id);

        var cleared = await (await admin.PutAsJsonAsync(
                $"/api/v1/console/catalog/products/{newcomer.Id}",
                new UpdateProductRequest(null, null, null, null, null, true, null, null, null, []),
                TestJson.Options,
                Ct))
            .ReadAsync<ConsoleProductDto>();
        cleared.LabelIds.ShouldBeEmpty();

        var autoLabel = await admin.PutAsJsonAsync(
            $"/api/v1/console/catalog/products/{newcomer.Id}",
            new UpdateProductRequest(null, null, null, null, null, true, null, null, null, [sale.Id]),
            TestJson.Options,
            Ct);
        autoLabel.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await autoLabel.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("labelIds");
    }

    [Fact]
    public async Task Custom_labels_are_managed_and_inactive_ones_hidden()
    {
        var manager = await Staff.ManagerAsync(api);
        var label = await CatalogDictionaries.CreateLabelAsync(manager, CatalogDictionaries.Unique("Сезон"), LabelTone.Blue);
        label.Kind.ShouldBe(LabelKind.Manual);
        label.ProductCount.ShouldBe(0);
        label.IsActive.ShouldBeTrue();

        var product = await api.AddProductAsync("vse-dlia-roslyn", "Насіння сезону", 35m, createdAt: DateTimeOffset.UtcNow.AddDays(-200));
        await (await manager.PostAsJsonAsync(
                "/api/v1/console/catalog/products/bulk",
                new BulkUpdateProductsRequest([product.Id], null, null, [label.Id], null, null),
                TestJson.Options,
                Ct))
            .ReadAsync<BulkUpdateProductsResult>();
        (await manager.ReadAsync<List<LabelDto>>(CatalogDictionaries.Labels)).Single(l => l.Id == label.Id).ProductCount.ShouldBe(1);
        (await StorefrontLabelsAsync(api.CreateClient(), product)).ShouldBe([new ProductLabelBadgeDto(label.Name, LabelTone.Blue)]);

        var kindChange = await manager.PutAsJsonAsync(
            $"{CatalogDictionaries.Labels}/{label.Id}",
            new SaveLabelRequest(label.Name, LabelTone.Blue, LabelKind.Sale, null, 10, true),
            TestJson.Options,
            Ct);
        kindChange.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await kindChange.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("kind");

        var inactive = await (await manager.PutAsJsonAsync(
                $"{CatalogDictionaries.Labels}/{label.Id}",
                new SaveLabelRequest(label.Name, LabelTone.Dark, null, null, 10, false),
                TestJson.Options,
                Ct))
            .ReadAsync<LabelDto>();
        inactive.IsActive.ShouldBeFalse();
        inactive.Tone.ShouldBe(LabelTone.Dark);
        (await StorefrontLabelsAsync(api.CreateClient(), product)).ShouldBeEmpty();

        (await manager.DeleteAsync($"{CatalogDictionaries.Labels}/{label.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await manager.ReadAsync<List<LabelDto>>(CatalogDictionaries.Labels)).ShouldNotContain(l => l.Id == label.Id);
    }

    [Fact]
    public async Task Active_automatic_labels_cannot_be_deleted()
    {
        var admin = await Staff.AdminAsync(api);
        var sale = (await admin.ReadAsync<List<LabelDto>>(CatalogDictionaries.Labels)).Single(l => l.Name == "Акція");
        var blocked = await admin.DeleteAsync($"{CatalogDictionaries.Labels}/{sale.Id}", Ct);
        blocked.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await blocked.ProblemCodeAsync()).ShouldBe("labels.auto_active");

        var badDays = await admin.PostAsJsonAsync(
            CatalogDictionaries.Labels,
            new SaveLabelRequest("Свіже", LabelTone.Green, LabelKind.New, 0, 5, true),
            TestJson.Options,
            Ct);
        badDays.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await badDays.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("newDays");

        var week = await (await admin.PostAsJsonAsync(
                CatalogDictionaries.Labels,
                new SaveLabelRequest("Тиждень", LabelTone.Gray, LabelKind.New, 7, 50, false),
                TestJson.Options,
                Ct))
            .ReadAsync<LabelDto>(HttpStatusCode.Created);
        week.NewDays.ShouldBe(7);
        (await admin.DeleteAsync($"{CatalogDictionaries.Labels}/{week.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    private static async Task<IReadOnlyList<ProductLabelBadgeDto>> StorefrontLabelsAsync(HttpClient client, Product product)
    {
        var found = await client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q={product.Sku}", TestJson.Options, Ct);
        return found!.Items.ShouldHaveSingleItem().Labels;
    }
}
