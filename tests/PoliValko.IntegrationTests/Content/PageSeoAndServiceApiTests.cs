using System.Net;
using System.Net.Http.Json;
using PoliValko.Content.Features.ServiceRequests;
using PoliValko.Content.Features.SiteContent;

namespace PoliValko.IntegrationTests;

public sealed class PageSeoAndServiceApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Page_seo_fields_reach_console_and_storefront()
    {
        var admin = await Staff.AdminAsync(api);
        var original = await admin.ReadAsync<PageDto>("/api/v1/console/content/pages/privacy");
        try
        {
            var saved = await (await admin.PutAsJsonAsync("/api/v1/console/content/pages/privacy", new SavePageRequest(
                    original.Title, original.Lead, original.BodyHtml, "  Політика приватності магазину  ", "Як ми зберігаємо ваші дані."), Ct))
                .ReadAsync<PageDto>();
            (saved.SeoTitle, saved.SeoDescription).ShouldBe(("Політика приватності магазину", "Як ми зберігаємо ваші дані."));

            var page = await api.CreateClient().GetFromJsonAsync<PageDto>("/api/v1/pages/privacy", TestJson.Options, Ct);
            (page!.SeoTitle, page.SeoDescription).ShouldBe(("Політика приватності магазину", "Як ми зберігаємо ваші дані."));
            (await admin.ReadAsync<List<ConsolePageListItemDto>>("/api/v1/console/content/pages"))
                .Single(p => p.Slug == "privacy").SeoTitle.ShouldBe("Політика приватності магазину");

            var tooLong = await admin.PutAsJsonAsync("/api/v1/console/content/pages/privacy", new SavePageRequest(
                original.Title, null, null, new string('с', 201), new string('о', 501)), Ct);
            tooLong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await tooLong.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["seoTitle", "seoDescription"], ignoreOrder: true);
        }
        finally
        {
            await admin.PutAsJsonAsync("/api/v1/console/content/pages/privacy", new SavePageRequest(
                original.Title, original.Lead, original.BodyHtml, original.SeoTitle, original.SeoDescription), Ct);
        }
    }

    [Fact]
    public async Task Service_direction_photo_is_saved_and_shown_publicly()
    {
        var admin = await Staff.AdminAsync(api);
        var original = (await admin.ReadAsync<List<ConsoleServiceDirectionDto>>("/api/v1/console/content/services")).Single(d => d.Code == "lawns");
        const string image = "/api/media/content/2026/11/lawn.webp";
        try
        {
            var saved = await (await admin.PutAsJsonAsync("/api/v1/console/content/services/lawns",
                    new SaveServiceDirectionRequest(original.Description, original.SortOrder, true, image), Ct))
                .ReadAsync<ConsoleServiceDirectionDto>();
            saved.ImageUrl.ShouldBe(image);

            var directions = await api.CreateClient().GetFromJsonAsync<List<ServiceDirectionDto>>("/api/v1/service-directions", TestJson.Options, Ct);
            directions!.Single(d => d.Code == "lawns").ImageUrl.ShouldBe(image);
            (await admin.ReadAsync<List<ConsoleServiceDirectionDto>>("/api/v1/console/content/services"))
                .Single(d => d.Code == "lawns").ImageUrl.ShouldBe(image);

            var invalid = await admin.PutAsJsonAsync("/api/v1/console/content/services/lawns",
                new SaveServiceDirectionRequest(original.Description, original.SortOrder, true, "javascript:alert(1)"), Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["imageUrl"]);
        }
        finally
        {
            await admin.PutAsJsonAsync("/api/v1/console/content/services/lawns",
                new SaveServiceDirectionRequest(original.Description, original.SortOrder, original.IsVisible, original.ImageUrl), Ct);
        }
    }
}
