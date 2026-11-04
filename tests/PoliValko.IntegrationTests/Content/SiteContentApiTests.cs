using System.Net;
using System.Net.Http.Json;
using PoliValko.Console.Features.Audit;
using PoliValko.Content.Features.SiteContent;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class SiteContentApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Admin_edits_pages_and_contacts_manager_cannot()
    {
        var admin = await Staff.AdminAsync(api);
        var saved = await (await admin.PutAsJsonAsync("/api/v1/console/content/pages/returns", new SavePageRequest(
                "Повернення й обмін", "14 днів", "<h2>Строк</h2><p onclick=\"x()\">14 днів</p><img src=x onerror=alert(1)>"), Ct))
            .ReadAsync<PageDto>();
        saved.BodyHtml.ShouldBe("<h2>Строк</h2><p>14 днів</p>");

        var page = await api.CreateClient().GetFromJsonAsync<PageDto>("/api/v1/pages/returns", TestJson.Options, Ct);
        page!.Lead.ShouldBe("14 днів");

        var contacts = new ContactsDto("+380 67 000 00 00", null, "shop@example.com", "м. Буча, вул. Тестова, 1", "Пн–Нд 9–19",
            "https://maps.example.com/bucha", null, null, null, null);
        (await admin.PutAsJsonAsync("/api/v1/console/content/contacts", contacts, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.CreateClient().GetFromJsonAsync<ContactsDto>("/api/v1/contacts", TestJson.Options, Ct)).ShouldBe(contacts);

        var badUrl = await admin.PutAsJsonAsync("/api/v1/console/content/contacts", contacts with { MapUrl = "javascript:alert(1)" }, Ct);
        badUrl.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var manager = await Staff.ManagerAsync(api);
        (await manager.PutAsJsonAsync("/api/v1/console/content/pages/returns", new SavePageRequest("x", null, null), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var audit = await admin.GetFromJsonAsync<PagedResponse<AuditEntryDto>>("/api/v1/console/audit?entityType=Page", TestJson.Options, Ct);
        audit!.Items.ShouldContain(e => e.Action == "content.page_updated" && e.EntityId == "returns" && e.Actor == "Адмін Тестовий");
    }
}
