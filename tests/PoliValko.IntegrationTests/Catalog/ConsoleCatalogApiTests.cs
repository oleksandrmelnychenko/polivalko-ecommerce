using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Features.Console.AttributeNames;
using PoliValko.Catalog.Features.Console.Categories;
using PoliValko.Catalog.Features.Console.Collections;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Navkolo.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleCatalogApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Site_fields_are_edited_sanitized_and_survive_navkolo_import()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Розпилювач для консолі", 410m, stock: 4);
        var manager = await Staff.ManagerAsync(api);
        var oldSlug = product.Slug;
        var newSlug = $"rozpyliuvach-{product.Id.ToString("N")[..8]}";
        var brand = await CatalogDictionaries.CreateBrandAsync(await Staff.AdminAsync(api), CatalogDictionaries.Unique("Gardena"));

        var updated = await (await manager.PutAsJsonAsync($"/api/v1/console/catalog/products/{product.Id}", new UpdateProductRequest(
                "Розпилювач латунний",
                newSlug,
                null,
                brand.Name.ToUpperInvariant(),
                "<p>Опис<script>alert(1)</script> з <a href=\"https://example.com\">посиланням</a></p>",
                true,
                "Розпилювач латунний — купити",
                null,
                [new ProductAttributeDto("Матеріал", "Латунь"), new ProductAttributeDto("Довжина", "20 см")]), TestJson.Options, Ct))
            .ReadAsync<ConsoleProductDto>();
        updated.DescriptionHtml.ShouldNotBeNull().ShouldNotContain("script");
        updated.DescriptionHtml.ShouldContain("rel=\"nofollow noopener\"");
        updated.Navkolo.Name.ShouldBe("Розпилювач для консолі");
        updated.Brand.ShouldBe(brand.Name);

        await api.WithScopeAsync(async services =>
        {
            var result = await services.GetRequiredService<ICatalogImporter>().ImportProductsAsync(
                [new NavkoloProductRecord(product.NavkoloId, product.Sku, "Розпилювач (нова назва ERP)", "Все для поливу", 455m, null, 7, Description: "Інший опис")],
                Ct);
            result.Updated.ShouldBe(1);
            return result;
        });

        var client = api.CreateClient();
        var details = await client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{newSlug}", TestJson.Options, Ct);
        details!.Name.ShouldBe("Розпилювач латунний");
        details.Price.ShouldBe(new MoneyDto("455.00", "UAH"));
        details.Attributes.ShouldBe([new ProductAttributeDto("Матеріал", "Латунь"), new ProductAttributeDto("Довжина", "20 см")]);
        details.SeoTitle.ShouldBe("Розпилювач латунний — купити");

        var redirect = await client.GetFromJsonAsync<RedirectDto>($"/api/v1/redirects/resolve?path=/product/{oldSlug}", TestJson.Options, Ct);
        redirect!.To.ShouldBe($"/product/{newSlug}");
    }

    [Fact]
    public async Task Attribute_names_and_image_upload_return_clean_lists()
    {
        var admin = await Staff.AdminAsync(api);
        var names = await admin.ReadAsync<List<AttributeNameDto>>("/api/v1/console/catalog/attribute-names");
        names.Select(n => n.Name).ShouldBeUnique();
        var unused = await CatalogDictionaries.EnsureAttributeAsync(admin, CatalogDictionaries.Unique("Без товарів"));
        names = await admin.ReadAsync<List<AttributeNameDto>>("/api/v1/console/catalog/attribute-names");
        names.ShouldContain(new AttributeNameDto(unused.Name, 0));
        names.Select(n => n.ProductCount).ShouldBeInOrder(SortDirection.Descending);

        var product = await api.AddProductAsync("vse-dlia-polyvu", "Лійка для фото", 120m);
        byte[] jpeg = [0xFF, 0xD8, 0xFF, 0xE0, .. new byte[64]];
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(jpeg);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(file, "file", "photo.jpg");
        var uploaded = await (await admin.PostAsync($"/api/v1/console/catalog/products/{product.Id}/images", form, Ct)).ReadAsync<ConsoleProductDto>();
        uploaded.Images.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Category_filters_produce_attribute_facets_and_filtering()
    {
        var admin = await Staff.AdminAsync(api);
        var categories = await admin.GetFromJsonAsync<List<ConsoleCategoryDto>>("/api/v1/console/catalog/categories", TestJson.Options, Ct);
        var parent = categories!.Single(c => c.Slug == "landshaftnyi-dyzain");
        var slug = $"svitylnyky-{Guid.NewGuid().ToString("N")[..6]}";
        await CatalogDictionaries.EnsureAttributeAsync(admin, "Колір");

        var created = await (await admin.PostAsJsonAsync("/api/v1/console/catalog/categories", new SaveCategoryRequest(
                parent.Id, "Світильники", slug, 1, true, null, ["Колір"], null, null), TestJson.Options, Ct))
            .ReadAsync<ConsoleCategoryDto>(HttpStatusCode.Created);

        var top = await admin.PostAsJsonAsync("/api/v1/console/catalog/categories", new SaveCategoryRequest(
            null, "Верхній", null, 1, true, null, null, null, null), TestJson.Options, Ct);
        top.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var black = await api.AddProductAsync("landshaftnyi-dyzain", "Світильник чорний", 300m);
        var white = await api.AddProductAsync("landshaftnyi-dyzain", "Світильник білий", 320m);
        foreach (var (product, color) in new[] { (black, "Чорний"), (white, "Білий") })
        {
            (await admin.PutAsJsonAsync($"/api/v1/console/catalog/products/{product.Id}", new UpdateProductRequest(
                    null, null, created.Id, null, null, true, null, null, [new ProductAttributeDto("Колір", color)]), TestJson.Options, Ct))
                .StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var client = api.CreateClient();
        var all = await client.GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?category={slug}", TestJson.Options, Ct);
        all!.Facets.Attributes.ShouldHaveSingleItem().Values.Select(v => v.Value).ShouldBe(["Білий", "Чорний"]);

        var filtered = await client.GetFromJsonAsync<ProductSearchResponse>(
            $"/api/v1/products?category={slug}&f={Uri.EscapeDataString("Колір:Чорний")}", TestJson.Options, Ct);
        filtered!.Items.ShouldHaveSingleItem().Id.ShouldBe(black.Id);

        var bad = await client.GetAsync($"/api/v1/products?category={slug}&f=bad", Ct);
        bad.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync("/api/v1/console/catalog/categories", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await manager.PostAsJsonAsync("/api/v1/console/catalog/categories", new { name = "Менеджерський розділ" }, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Collections_show_visible_products_in_order()
    {
        var first = await api.AddProductAsync("novyi-rik", "Куля для добірки", 50m);
        var hidden = await api.AddProductAsync("novyi-rik", "Прихована куля", 60m, visible: false);
        var second = await api.AddProductAsync("novyi-rik", "Мішура для добірки", 70m);
        var manager = await Staff.ManagerAsync(api);
        var code = $"ny-{Guid.NewGuid().ToString("N")[..6]}";

        await (await manager.PostAsJsonAsync("/api/v1/console/catalog/collections", new SaveCollectionRequest(
                code, "Новорічне", 5, true, [second.Id, hidden.Id, first.Id]), TestJson.Options, Ct))
            .ReadAsync<ConsoleCollectionDto>(HttpStatusCode.Created);

        var collections = await api.CreateClient().GetFromJsonAsync<List<CollectionDto>>("/api/v1/collections", TestJson.Options, Ct);
        collections!.Single(c => c.Code == code).Items.Select(i => i.Id).ShouldBe([second.Id, first.Id]);
    }

    [Fact]
    public async Task Csv_import_reports_row_errors_and_creates_valid_products()
    {
        var suffix = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        var csv = $""""
            navkolo_id;sku;name;group;price;old_price;stock;brand
            imp-{suffix}-1;IMP-{suffix}-1;"Граблі ""віялові""";Ручний інструмент;349,50;;12;Fiskars
            imp-{suffix}-2;IMP-{suffix}-2;Без групи;;100;;1;
            imp-{suffix}-3;IMP-{suffix}-3;Невідома група;Не існує;100;;1;
            imp-{suffix}-1;IMP-{suffix}-9;Дублікат;Ручний інструмент;100;;1;
            imp-{suffix}-4;IMP-{suffix}-4;Хлам товар;Хлам;10;;1;
            """";
        var admin = await Staff.AdminAsync(api);
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        form.Add(file, "file", "catalog.csv");

        var run = await (await admin.PostAsync("/api/v1/console/integration/navkolo/import", form, Ct)).ReadAsync<ImportRunDto>();

        run.Status.ShouldBe(PoliValko.Infrastructure.Sync.SyncRunStatus.PartiallySucceeded);
        run.Errors.Select(e => e.Message).ShouldContain(m => m.Contains("групи", StringComparison.Ordinal));
        run.Errors.ShouldContain(e => e.Message.Contains("Невідома група", StringComparison.Ordinal));
        run.Errors.ShouldContain(e => e.Message.Contains("Дублікат", StringComparison.Ordinal));
        run.Summary.ShouldNotBeNull().ShouldContain("Нових: 1");

        var found = await api.CreateClient().GetFromJsonAsync<ProductSearchResponse>($"/api/v1/products?q=IMP-{suffix}-1", TestJson.Options, Ct);
        var item = found!.Items.ShouldHaveSingleItem();
        item.Name.ShouldBe("Граблі \"віялові\"");
        item.Price.Value.ShouldBe("349.50");
    }
}
