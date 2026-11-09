using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Features.Storefront;
using PoliValko.Content;
using PoliValko.Content.Features.Site;
using PoliValko.Infrastructure.Settings;

namespace PoliValko.IntegrationTests;

public sealed class SeoTemplatesApiTests(ApiFactory api)
{
    private const string Templates = "/api/v1/console/site/seo-templates";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Templates_saved_in_console_fill_storefront_product_and_category_meta()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Дощувач шаблонний", 349m, brand: "Gardena");
        var admin = await Staff.AdminAsync(api);
        var original = await SnapshotAsync();
        try
        {
            api.Storefront.Tags.Clear();
            var saved = await (await admin.PutAsJsonAsync(Templates, new SeoTemplatesDto(
                    new SeoTemplateDto("{name} від {brand} — {price}", "{name} у розділі {category}, магазин {shop}."),
                    new SeoTemplateDto("{name} — купити в Бучі", "")), TestJson.Options, Ct))
                .ReadAsync<SeoTemplatesDto>();
            saved.Category.Description.ShouldBe(string.Empty);
            api.Storefront.Tags.ShouldBe(["catalog", "products", "categories"], ignoreOrder: true);
            (await admin.ReadAsync<SeoTemplatesDto>(Templates)).ShouldBe(saved);

            var client = api.CreateClient();
            var details = await client.GetFromJsonAsync<ProductDetailsDto>($"/api/v1/products/{product.Slug}", TestJson.Options, Ct);
            details!.SeoTitle.ShouldBe("Дощувач шаблонний від Gardena — 349 грн");
            var category = await client.GetFromJsonAsync<CategoryDto>("/api/v1/categories/vse-dlia-polyvu", TestJson.Options, Ct);
            details.SeoDescription.ShouldBe($"Дощувач шаблонний у розділі {category!.Name}, магазин Poli Valko.");
            category.SeoTitle.ShouldBe($"{category.Name} — купити в Бучі");

            var invalid = await admin.PutAsJsonAsync(Templates, new SeoTemplatesDto(
                new SeoTemplateDto("", "{name} {discount}"),
                new SeoTemplateDto("{name} {price}", new string('ш', 301))), TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys
                .ShouldBe(["product.title", "product.description", "category.title", "category.description"], ignoreOrder: true);

            var manager = await Staff.ManagerAsync(api);
            (await manager.GetAsync(Templates, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        }
        finally
        {
            await RestoreAsync(original);
        }
    }

    [Fact]
    public async Task Startup_seed_keeps_saved_templates_and_defaults_have_no_shop_name()
    {
        SeoTemplateSettings.Defaults.Product.Title.ShouldBe("{name}: ціна {price}, купити з доставкою");
        SeoTemplateSettings.Defaults.Category.Title.ShouldBe("{name}: купити з доставкою по Україні");
        SeoTemplateSettings.Defaults.Product.Title.ShouldNotContain("Poli Valko");
        SeoTemplateSettings.Defaults.Product.Title.ShouldNotContain("{shop}");

        var admin = await Staff.AdminAsync(api);
        var original = await SnapshotAsync();
        try
        {
            var custom = new SeoTemplatesDto(new SeoTemplateDto("{name} власний", ""), new SeoTemplateDto("{name} власна", ""));
            await (await admin.PutAsJsonAsync(Templates, custom, TestJson.Options, Ct)).ReadAsync<SeoTemplatesDto>();
            await api.WithScopeAsync(async services =>
            {
                await ContentModule.SeedSiteAsync(services, Ct);
                return true;
            });

            (await admin.ReadAsync<SeoTemplatesDto>(Templates)).ShouldBe(custom);
        }
        finally
        {
            await RestoreAsync(original);
        }
    }

    private Task<JsonElement?> SnapshotAsync() =>
        api.WithScopeAsync(services => services.GetRequiredService<ISettingsStore>().GetAsync<JsonElement?>(SeoTemplateSettings.SettingsKey, Ct));

    private Task RestoreAsync(JsonElement? original) =>
        api.WithScopeAsync(async services =>
        {
            var store = services.GetRequiredService<ISettingsStore>();
            if (original is { } value)
            {
                await store.SaveAsync(SeoTemplateSettings.SettingsKey, value, "tests", Ct);
            }
            else
            {
                await store.SaveAsync(SeoTemplateSettings.SettingsKey, SeoTemplateSettings.Defaults, "tests", Ct);
            }

            return true;
        });
}
