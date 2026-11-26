using System.Net;
using System.Net.Http.Json;
using PoliValko.Content.Features.ServiceRequests;
using PoliValko.Content.Features.SiteContent;

namespace PoliValko.IntegrationTests;

public sealed class ServicePagesApiTests(ApiFactory api)
{
    private const string Services = "/api/v1/console/content/services";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Service_page_has_own_address_text_and_seo_and_hides_with_the_service()
    {
        var admin = await Staff.AdminAsync(api);
        var client = api.CreateClient();
        var original = (await admin.ReadAsync<List<ConsoleServiceDirectionDto>>(Services)).Single(d => d.Code == "greening");
        original.DefaultSlug.ShouldBe("ozelenennia");
        try
        {
            var saved = await (await admin.PutAsJsonAsync($"{Services}/greening", new SaveServiceDirectionRequest(
                    original.Description, original.SortOrder, true, original.ImageUrl,
                    Slug: "ozelenennia-dilianky",
                    BodyHtml: "<h2>Що входить</h2><p>Підбір рослин.</p><script>alert(1)</script>",
                    SeoTitle: "Озеленення ділянки в Бучі",
                    SeoDescription: "Підбір і висадка дерев і кущів."), TestJson.Options, Ct))
                .ReadAsync<ConsoleServiceDirectionDto>();
            saved.Slug.ShouldBe("ozelenennia-dilianky");
            saved.BodyHtml.ShouldNotBeNull().ShouldNotContain("<script");
            saved.UpdatedAt.ShouldNotBeNull();

            var page = await client.GetFromJsonAsync<ServiceDirectionPageDto>("/api/v1/service-directions/ozelenennia-dilianky", TestJson.Options, Ct);
            page!.Code.ShouldBe("greening");
            page.Name.ShouldBe("Озеленення");
            page.SeoTitle.ShouldBe("Озеленення ділянки в Бучі");
            page.BodyHtml.ShouldNotBeNull().ShouldContain("Підбір рослин");
            (await client.GetAsync("/api/v1/service-directions/ozelenennia", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);

            var listed = (await client.GetFromJsonAsync<List<ServiceDirectionDto>>("/api/v1/service-directions", TestJson.Options, Ct))!
                .Single(d => d.Code == "greening");
            listed.Slug.ShouldBe("ozelenennia-dilianky");
            listed.HasPage.ShouldBeTrue();

            // Fields left out keep their value: an older console cannot wipe the page.
            var kept = await (await admin.PutAsJsonAsync($"{Services}/greening",
                    new SaveServiceDirectionRequest(original.Description, original.SortOrder, true, original.ImageUrl), TestJson.Options, Ct))
                .ReadAsync<ConsoleServiceDirectionDto>();
            kept.Slug.ShouldBe("ozelenennia-dilianky");
            kept.BodyHtml.ShouldNotBeNull();

            // Another service's address and a malformed address are refused.
            foreach (var bad in new[] { "hazony", "Озеленення", "two--dashes" })
            {
                var refused = await admin.PutAsJsonAsync($"{Services}/greening",
                    new SaveServiceDirectionRequest(original.Description, original.SortOrder, true, original.ImageUrl, Slug: bad), TestJson.Options, Ct);
                refused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
                (await refused.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("slug");
            }

            // A hidden service has no page.
            (await admin.PutAsJsonAsync($"{Services}/greening",
                new SaveServiceDirectionRequest(original.Description, original.SortOrder, false, original.ImageUrl), TestJson.Options, Ct)).EnsureSuccessStatusCode();
            (await client.GetAsync("/api/v1/service-directions/ozelenennia-dilianky", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        }
        finally
        {
            (await admin.PutAsJsonAsync($"{Services}/greening", new SaveServiceDirectionRequest(
                original.Description, original.SortOrder, original.IsVisible, original.ImageUrl,
                Slug: original.Slug == original.DefaultSlug ? "" : original.Slug,
                BodyHtml: original.BodyHtml ?? "",
                SeoTitle: original.SeoTitle ?? "",
                SeoDescription: original.SeoDescription ?? ""), TestJson.Options, Ct)).EnsureSuccessStatusCode();
        }
    }
}
