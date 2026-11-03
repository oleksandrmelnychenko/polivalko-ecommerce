using System.Net;
using System.Net.Http.Json;
using PoliValko.Identity.Features.Auth;
using PoliValko.Identity.Features.Staff;

namespace PoliValko.IntegrationTests;

public sealed class StaffApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

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
}
