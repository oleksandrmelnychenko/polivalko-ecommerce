using System.Net;
using System.Net.Http.Json;
using PoliValko.Api;
using PoliValko.Content.Api;
using PoliValko.Identity;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

/// <summary>Тексти, контакти, доступи працівників, журнал змін і ручний повтор операцій (розділ 9 ТЗ).</summary>
public sealed class ContentAndStaffApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Admin_edits_pages_and_contacts_manager_cannot()
    {
        var admin = await Staff.AdminAsync(api);
        var saved = await (await admin.PutAsJsonAsync("/api/v1/admin/content/pages/returns", new SavePageRequest(
                "Повернення й обмін", "14 днів", "<h2>Строк</h2><p onclick=\"x()\">14 днів</p><img src=x onerror=alert(1)>"), Ct))
            .ReadAsync<PageDto>();
        saved.BodyHtml.ShouldBe("<h2>Строк</h2><p>14 днів</p>");

        var page = await api.CreateClient().GetFromJsonAsync<PageDto>("/api/v1/pages/returns", TestJson.Options, Ct);
        page!.Lead.ShouldBe("14 днів");

        var contacts = new ContactsDto("+380 67 000 00 00", null, "shop@example.com", "м. Буча, вул. Тестова, 1", "Пн–Нд 9–19",
            "https://maps.example.com/bucha", null, null, null, null);
        (await admin.PutAsJsonAsync("/api/v1/admin/content/contacts", contacts, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.CreateClient().GetFromJsonAsync<ContactsDto>("/api/v1/contacts", TestJson.Options, Ct)).ShouldBe(contacts);

        var badUrl = await admin.PutAsJsonAsync("/api/v1/admin/content/contacts", contacts with { MapUrl = "javascript:alert(1)" }, Ct);
        badUrl.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var manager = await Staff.ManagerAsync(api);
        (await manager.PutAsJsonAsync("/api/v1/admin/content/pages/returns", new SavePageRequest("x", null, null), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var audit = await admin.GetFromJsonAsync<PagedResponse<AuditEntryDto>>("/api/v1/admin/audit?entityType=Page", TestJson.Options, Ct);
        audit!.Items.ShouldContain(e => e.Action == "content.page_updated" && e.EntityId == "returns" && e.Actor == "Адмін Тестовий");
    }

    [Fact]
    public async Task Admin_manages_staff_and_lock_blocks_login()
    {
        var admin = await Staff.AdminAsync(api);
        var email = $"new-{Guid.NewGuid():N}@tests.polivalko.local";

        var weak = await admin.PostAsJsonAsync("/api/v1/admin/users", new CreateStaffUserRequest(email, "Новий Менеджер", "Manager", "short"), Ct);
        weak.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var user = await (await admin.PostAsJsonAsync("/api/v1/admin/users", new CreateStaffUserRequest(email, "Новий Менеджер", "Manager", ApiFactory.TestPassword), Ct))
            .ReadAsync<StaffUserDto>(HttpStatusCode.Created);
        user.Roles.ShouldBe(["Manager"]);

        var newcomer = await Staff.LoginAsync(api, email);
        (await newcomer.GetAsync("/api/v1/admin/users", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var locked = await (await admin.PostAsJsonAsync($"/api/v1/admin/users/{user.Id}/lock", new LockStaffUserRequest(true), Ct)).ReadAsync<StaffUserDto>();
        locked.LockedOut.ShouldBeTrue();
        var login = await api.CreateClient().PostAsJsonAsync("/api/v1/admin/auth/login", new LoginRequest(email, ApiFactory.TestPassword), Ct);
        login.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var me = await admin.GetFromJsonAsync<List<StaffUserDto>>("/api/v1/admin/users", TestJson.Options, Ct);
        var self = me!.Single(u => u.Email == ApiFactory.AdminEmail);
        (await admin.PostAsJsonAsync($"/api/v1/admin/users/{self.Id}/lock", new LockStaffUserRequest(true), Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await admin.PutAsJsonAsync($"/api/v1/admin/users/{self.Id}", new UpdateStaffUserRequest("Адмін Тестовий", "Manager"), Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Failed_operation_can_be_retried_manually()
    {
        var id = await api.WithDbAsync(async db =>
        {
            var message = new PoliValko.Infrastructure.Outbox.OutboxMessage
            {
                Id = Guid.CreateVersion7(),
                Type = "tests.always-failing",
                Payload = "{\"marker\":\"manual-retry\"}",
                OccurredAt = DateTimeOffset.UtcNow,
                NextAttemptAt = DateTimeOffset.UtcNow,
                Status = PoliValko.Infrastructure.Outbox.OutboxStatus.Failed,
                Attempts = 10,
                LastError = "Navkolo недоступна",
            };
            db.OutboxMessages.Add(message);
            await db.SaveChangesAsync(Ct);
            return message.Id;
        });

        var admin = await Staff.AdminAsync(api);
        var failed = await admin.GetFromJsonAsync<List<OutboxMessageDto>>("/api/v1/admin/integration/outbox", TestJson.Options, Ct);
        failed!.ShouldContain(m => m.Id == id);

        (await admin.PostAsync($"/api/v1/admin/integration/outbox/{id}/retry", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var status = await admin.GetFromJsonAsync<IntegrationStatusDto>("/api/v1/admin/integration/status", TestJson.Options, Ct);
        status!.OutboxPending.ShouldBeGreaterThan(0);
        status.Jobs.ShouldContain(j => j.Job == "navkolo.price-stock");

        var manager = await Staff.ManagerAsync(api);
        (await manager.PostAsync($"/api/v1/admin/integration/outbox/{id}/retry", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
