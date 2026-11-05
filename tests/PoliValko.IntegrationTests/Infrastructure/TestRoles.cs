using System.Net;
using System.Net.Http.Json;
using PoliValko.Identity.Features.Roles;
using PoliValko.Identity.Features.Staff;

namespace PoliValko.IntegrationTests;

internal static class TestRoles
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static async Task<HttpClient> LoginWithPermissionsAsync(ApiFactory api, HttpClient admin, params string[] permissions)
    {
        var role = await (await admin.PostAsJsonAsync(
                "/api/v1/console/roles",
                new SaveStaffRoleRequest($"Тест {Guid.NewGuid():N}"[..20], null, null),
                Ct))
            .ReadAsync<StaffRoleDto>(HttpStatusCode.Created);
        await (await admin.PutAsJsonAsync(
                $"/api/v1/console/roles/{role.Id}/permissions",
                new UpdateRolePermissionsRequest(0, permissions),
                Ct))
            .ReadAsync<RolePermissionsDto>();
        var email = $"role-{Guid.NewGuid():N}@tests.polivalko.local";
        await (await admin.PostAsJsonAsync("/api/v1/console/users", new CreateStaffUserRequest(email, "Працівник з роллю", role.Id, ApiFactory.TestPassword), Ct))
            .ReadAsync<StaffUserDto>(HttpStatusCode.Created);
        return await Staff.LoginAsync(api, email);
    }
}
