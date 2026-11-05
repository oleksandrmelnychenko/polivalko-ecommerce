using System.Net;
using System.Net.Http.Json;
using PoliValko.Console.Features.Search;
using PoliValko.Identity.Features.Permissions;
using PoliValko.Identity.Features.Roles;
using PoliValko.Identity.Features.Staff;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.IntegrationTests;

public sealed class RoleApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Catalog_and_own_permissions_reflect_the_role()
    {
        var admin = await Staff.AdminAsync(api);
        var catalog = await admin.ReadAsync<PermissionCatalogDto>("/api/v1/console/permissions/catalog");
        catalog.Version.ShouldBe(PermissionCatalog.Version);
        catalog.Permissions.Select(p => p.Key).ShouldBe(PermissionCatalog.AllKeys);

        var mine = await admin.ReadAsync<MyPermissionsDto>("/api/v1/console/permissions/me");
        mine.IsSuperuser.ShouldBeTrue();
        mine.RoleName.ShouldBe("Адміністратор");
        mine.PermissionKeys.ShouldBe(PermissionCatalog.AllKeys);

        var manager = await Staff.ManagerAsync(api);
        var managers = await manager.ReadAsync<MyPermissionsDto>("/api/v1/console/permissions/me");
        managers.IsSuperuser.ShouldBeFalse();
        managers.PermissionKeys.ShouldContain(PermissionKeys.OrdersView);
        managers.PermissionKeys.ShouldNotContain(PermissionKeys.StaffUsersManage);
        (await manager.GetAsync("/api/v1/console/roles", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Custom_role_limits_access_and_changes_apply_at_once()
    {
        var admin = await Staff.AdminAsync(api);
        var role = await (await admin.PostAsJsonAsync(
                "/api/v1/console/roles",
                new SaveStaffRoleRequest($"Склад {Guid.NewGuid():N}"[..20], "Лише замовлення", null),
                Ct))
            .ReadAsync<StaffRoleDto>(HttpStatusCode.Created);
        role.IsSystem.ShouldBeFalse();
        role.PermissionCount.ShouldBe(0);

        var granted = await (await admin.PutAsJsonAsync(
                $"/api/v1/console/roles/{role.Id}/permissions",
                new UpdateRolePermissionsRequest(0, [PermissionKeys.OrdersView]),
                Ct))
            .ReadAsync<RolePermissionsDto>();
        granted.Version.ShouldBe(1);
        granted.PermissionKeys.ShouldBe([PermissionKeys.OrdersView]);

        var email = $"store-{Guid.NewGuid():N}@tests.polivalko.local";
        await (await admin.PostAsJsonAsync("/api/v1/console/users", new CreateStaffUserRequest(email, "Комірник", role.Id, ApiFactory.TestPassword), Ct))
            .ReadAsync<StaffUserDto>(HttpStatusCode.Created);
        var storekeeper = await Staff.LoginAsync(api, email);

        (await storekeeper.GetAsync("/api/v1/console/orders", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await storekeeper.GetAsync("/api/v1/console/catalog/products", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await storekeeper.GetAsync("/api/v1/console/dashboard", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var search = await storekeeper.ReadAsync<ConsoleSearchDto>("/api/v1/console/search?q=лопата");
        search.Products.ShouldBeEmpty();

        await (await admin.PutAsJsonAsync(
                $"/api/v1/console/roles/{role.Id}/permissions",
                new UpdateRolePermissionsRequest(1, [PermissionKeys.OrdersView, PermissionKeys.ProductsView]),
                Ct))
            .ReadAsync<RolePermissionsDto>();
        (await storekeeper.GetAsync("/api/v1/console/catalog/products", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var stale = await admin.PutAsJsonAsync(
            $"/api/v1/console/roles/{role.Id}/permissions",
            new UpdateRolePermissionsRequest(1, [PermissionKeys.OrdersView]),
            Ct);
        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await stale.ProblemCodeAsync()).ShouldBe("roles.version_conflict");

        var unknown = await admin.PutAsJsonAsync(
            $"/api/v1/console/roles/{role.Id}/permissions",
            new UpdateRolePermissionsRequest(2, ["orders.everything"]),
            Ct);
        unknown.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await unknown.ProblemCodeAsync()).ShouldBe("roles.unknown_permissions");
    }

    [Fact]
    public async Task System_and_used_roles_are_protected()
    {
        var admin = await Staff.AdminAsync(api);
        var adminRole = await Staff.RoleIdAsync(admin, "Адміністратор");
        var managerRole = await Staff.RoleIdAsync(admin, "Менеджер");

        var superuser = await admin.PutAsJsonAsync($"/api/v1/console/roles/{adminRole}/permissions", new UpdateRolePermissionsRequest(0, []), Ct);
        superuser.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await superuser.ProblemCodeAsync()).ShouldBe("roles.superuser");

        var system = await admin.DeleteAsync($"/api/v1/console/roles/{managerRole}", Ct);
        system.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await system.ProblemCodeAsync()).ShouldBe("roles.system");

        var role = await (await admin.PostAsJsonAsync(
                "/api/v1/console/roles",
                new SaveStaffRoleRequest($"Тимчасова {Guid.NewGuid():N}"[..24], null, managerRole),
                Ct))
            .ReadAsync<StaffRoleDto>(HttpStatusCode.Created);
        role.PermissionCount.ShouldBe(PermissionCatalog.ManagerDefaults.Count);

        var duplicate = await admin.PostAsJsonAsync("/api/v1/console/roles", new SaveStaffRoleRequest(role.Name.ToUpperInvariant(), null, null), Ct);
        duplicate.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var email = $"temp-{Guid.NewGuid():N}@tests.polivalko.local";
        var user = await (await admin.PostAsJsonAsync("/api/v1/console/users", new CreateStaffUserRequest(email, "Тимчасовий", role.Id, ApiFactory.TestPassword), Ct))
            .ReadAsync<StaffUserDto>(HttpStatusCode.Created);

        var inUse = await admin.DeleteAsync($"/api/v1/console/roles/{role.Id}", Ct);
        inUse.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await inUse.ProblemCodeAsync()).ShouldBe("roles.in_use");

        await (await admin.PutAsJsonAsync($"/api/v1/console/users/{user.Id}", new UpdateStaffUserRequest("Тимчасовий", managerRole), Ct)).ReadAsync<StaffUserDto>();
        (await admin.DeleteAsync($"/api/v1/console/roles/{role.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Staff_without_a_right_cannot_grant_it()
    {
        var admin = await Staff.AdminAsync(api);
        var hr = await (await admin.PostAsJsonAsync("/api/v1/console/roles", new SaveStaffRoleRequest($"Кадри {Guid.NewGuid():N}"[..20], null, null), Ct))
            .ReadAsync<StaffRoleDto>(HttpStatusCode.Created);
        await (await admin.PutAsJsonAsync(
                $"/api/v1/console/roles/{hr.Id}/permissions",
                new UpdateRolePermissionsRequest(0, [PermissionKeys.StaffUsersManage, PermissionKeys.StaffRolesManage, PermissionKeys.OrdersView]),
                Ct))
            .ReadAsync<RolePermissionsDto>();
        var email = $"hr-{Guid.NewGuid():N}@tests.polivalko.local";
        await (await admin.PostAsJsonAsync("/api/v1/console/users", new CreateStaffUserRequest(email, "Кадровик", hr.Id, ApiFactory.TestPassword), Ct))
            .ReadAsync<StaffUserDto>(HttpStatusCode.Created);
        var officer = await Staff.LoginAsync(api, email);

        var role = await (await officer.PostAsJsonAsync("/api/v1/console/roles", new SaveStaffRoleRequest($"Нова {Guid.NewGuid():N}"[..20], null, null), Ct))
            .ReadAsync<StaffRoleDto>(HttpStatusCode.Created);
        var escalation = await officer.PutAsJsonAsync(
            $"/api/v1/console/roles/{role.Id}/permissions",
            new UpdateRolePermissionsRequest(0, [PermissionKeys.OrdersView, PermissionKeys.CatalogImportRun]),
            Ct);
        escalation.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await escalation.ProblemCodeAsync()).ShouldBe("roles.escalation");

        var adminRole = await Staff.RoleIdAsync(officer, "Адміністратор");
        var promote = await officer.PostAsJsonAsync(
            "/api/v1/console/users",
            new CreateStaffUserRequest($"boss-{Guid.NewGuid():N}@tests.polivalko.local", "Самопризначений", adminRole, ApiFactory.TestPassword),
            Ct);
        promote.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await promote.ProblemCodeAsync()).ShouldBe("staff.escalation");
    }
}
