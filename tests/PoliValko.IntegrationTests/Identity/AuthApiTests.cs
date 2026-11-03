using System.Net;
using System.Net.Http.Json;
using PoliValko.Identity.Features.Auth;

namespace PoliValko.IntegrationTests;

public sealed class AuthApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Admin_endpoints_require_login()
    {
        var response = await api.CreateClient().GetAsync("/api/v1/admin/orders", Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        response.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.unauthorized");
    }

    [Fact]
    public async Task Wrong_password_is_rejected()
    {
        var response = await api.CreateClient().PostAsJsonAsync(
            "/api/v1/admin/auth/login",
            new LoginRequest(ApiFactory.ManagerEmail, "not-the-password"),
            Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.invalid_credentials");
    }

    [Fact]
    public async Task Manager_cannot_list_users()
    {
        var manager = await Staff.SignInAsync(api, ApiFactory.ManagerEmail);

        var me = await manager.GetFromJsonAsync<StaffMeDto>("/api/v1/admin/auth/me", Ct);
        me!.Roles.ShouldBe(["Manager"]);

        var response = await manager.GetAsync("/api/v1/admin/users", Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.forbidden");
    }
}
