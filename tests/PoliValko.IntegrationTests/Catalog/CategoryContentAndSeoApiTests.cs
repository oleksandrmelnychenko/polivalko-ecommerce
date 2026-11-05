using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Features.Console.Categories;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.IntegrationTests;

public sealed class CategoryContentAndSeoApiTests(ApiFactory api)
{
    private const string Categories = "/api/v1/console/catalog/categories";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Category_photo_and_description_reach_console_and_storefront()
    {
        var admin = await Staff.AdminAsync(api);
        var parent = (await admin.ReadAsync<List<ConsoleCategoryDto>>(Categories)).Single(c => c.Slug == "vse-dlia-roslyn");
        var slug = $"kashpo-{Guid.NewGuid().ToString("N")[..6]}";
        const string image = "/api/media/content/2026/11/kashpo.webp";
        const string description = "Кашпо для дому й саду.\n\nПластик, кераміка, метал.";

        var invalid = await admin.PostAsJsonAsync(Categories, new SaveCategoryRequest(
            parent.Id, "Кашпо", slug, 1, true, null, null, null, null, "javascript:alert(1)", new string('а', 2001)), TestJson.Options, Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["imageUrl", "description"], ignoreOrder: true);

        var created = await (await admin.PostAsJsonAsync(Categories, new SaveCategoryRequest(
                parent.Id, "Кашпо", slug, 1, true, null, null, null, null, image, description), TestJson.Options, Ct))
            .ReadAsync<ConsoleCategoryDto>(HttpStatusCode.Created);
        created.ImageUrl.ShouldBe(image);
        created.Description.ShouldBe(description);

        var client = api.CreateClient();
        var page = await client.GetFromJsonAsync<CategoryDto>($"/api/v1/categories/{slug}", TestJson.Options, Ct);
        page!.ImageUrl.ShouldBe(image);
        page.Description.ShouldBe(description);
        var tree = await client.GetFromJsonAsync<List<CategoryNodeDto>>("/api/v1/categories", TestJson.Options, Ct);
        var node = tree!.Single(n => n.Slug == "vse-dlia-roslyn").Children.Single(c => c.Slug == slug);
        (node.ImageUrl, node.Description).ShouldBe((image, description));

        var hidden = await (await admin.PutAsJsonAsync($"{Categories}/{created.Id}", new SaveCategoryRequest(
                parent.Id, "Кашпо", slug, 1, false, null, null, null, null, null, null), TestJson.Options, Ct))
            .ReadAsync<ConsoleCategoryDto>();
        hidden.ImageUrl.ShouldBeNull();
        (await client.GetAsync($"/api/v1/categories/{slug}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var viewer = await TestRoles.LoginWithPermissionsAsync(api, admin, PoliValko.Infrastructure.Security.Permissions.PermissionKeys.ProductsView);
        (await viewer.ReadAsync<List<ConsoleCategoryDto>>(Categories)).Single(c => c.Id == created.Id).IsVisible.ShouldBeFalse();
    }

    [Fact]
    public async Task Seo_templates_fill_empty_product_and_category_meta()
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", "Сапка шаблонна", 1249.5m, brand: "Fiskars");
        var own = await api.AddProductAsync("ruchnyi-instrument", "Сапка зі своїм SEO", 300m);
        var admin = await Staff.AdminAsync(api);
        await admin.PutAsJsonAsync($"/api/v1/console/catalog/products/{own.Id}", new PoliValko.Catalog.Features.Console.Products.UpdateProductRequest(
            null, null, null, null, null, true, "Власний заголовок", null, null), TestJson.Options, Ct);

        await SaveTemplatesAsync(new
        {
            product = new { title = "{name} {brand} — купити за {price} | {shop}", description = "{name} у розділі {category}." },
            category = new { title = "{name} — {category} | {shop}", description = (string?)null },
        });
        try
        {
            var client = api.CreateClient();
            var details = await client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{product.Slug}", TestJson.Options, Ct);
            details!.SeoTitle.ShouldBe("Сапка шаблонна Fiskars — купити за 1 249,50 грн | Poli Valko");
            details.SeoDescription.ShouldBe("Сапка шаблонна у розділі Ручний інструмент.");

            var ownDetails = await client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{own.Slug}", TestJson.Options, Ct);
            ownDetails!.SeoTitle.ShouldBe("Власний заголовок");
            ownDetails.SeoDescription.ShouldBe("Сапка зі своїм SEO у розділі Ручний інструмент.");

            var category = await client.GetFromJsonAsync<CategoryDto>("/api/v1/categories/ruchnyi-instrument", TestJson.Options, Ct);
            category!.SeoTitle.ShouldBe("Ручний інструмент — Ручний інструмент | Poli Valko");
            category.SeoDescription.ShouldBeNull();
        }
        finally
        {
            await SaveTemplatesAsync(new { });
        }

        var reset = await api.CreateClient().GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{product.Slug}", TestJson.Options, Ct);
        reset!.SeoTitle.ShouldBeNull();
    }

    private Task SaveTemplatesAsync(object value) =>
        api.WithScopeAsync(async services =>
        {
            await services.GetRequiredService<ISettingsStore>().SaveAsync("seo.templates", value, "tests", Ct);
            return true;
        });
}
