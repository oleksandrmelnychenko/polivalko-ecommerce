using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Identity.Features.Auth;
using PoliValko.Identity.Features.Staff;
using PoliValko.Identity.Features.TwoFactor;
using PoliValko.Infrastructure.Security;

namespace PoliValko.IntegrationTests;

public sealed class TwoFactorApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Admin_enables_authenticator_and_login_asks_for_code()
    {
        var email = await CreateAdminAsync();
        var client = await Staff.LoginAsync(api, email);

        var setup = await (await client.PostAsync("/api/v1/console/auth/two-factor/setup", null, Ct)).ReadAsync<TwoFactorSetupDto>();
        setup.AuthenticatorUri.ShouldStartWith("otpauth://totp/Poli%20Valko:");
        var wrong = await client.PostAsJsonAsync("/api/v1/console/auth/two-factor/enable", new TwoFactorCodeRequest("000000"), Ct);
        wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var codes = await (await client.PostAsJsonAsync("/api/v1/console/auth/two-factor/enable", new TwoFactorCodeRequest(Totp.Code(setup.SharedKey)), Ct))
            .ReadAsync<TwoFactorRecoveryCodesDto>();
        codes.RecoveryCodes.Count.ShouldBe(10);
        (await client.ReadAsync<TwoFactorStatusDto>("/api/v1/console/auth/two-factor")).ShouldBe(new TwoFactorStatusDto(true, 10));
        (await client.GetAsync("/api/v1/console/auth/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var anonymous = api.CreateClient();
        var noCode = await anonymous.PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(email, ApiFactory.TestPassword), Ct);
        noCode.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await noCode.ProblemCodeAsync()).ShouldBe("auth.two_factor_required");
        (await anonymous.GetAsync("/api/v1/console/auth/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var badCode = await anonymous.PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(email, ApiFactory.TestPassword, "123456"), Ct);
        (await badCode.ProblemCodeAsync()).ShouldBe("auth.invalid_two_factor_code");

        (await anonymous.PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(email, ApiFactory.TestPassword, Totp.Code(setup.SharedKey)), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        (await anonymous.GetAsync("/api/v1/console/auth/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var recovery = codes.RecoveryCodes[0];
        (await api.CreateClient().PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(email, ApiFactory.TestPassword, recovery.ToLowerInvariant()), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.CreateClient().PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(email, ApiFactory.TestPassword, recovery), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await client.ReadAsync<TwoFactorStatusDto>("/api/v1/console/auth/two-factor")).RecoveryCodesLeft.ShouldBe(9);

        (await client.PostAsJsonAsync("/api/v1/console/auth/two-factor/disable", new TwoFactorCodeRequest(Totp.Code(setup.SharedKey)), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await api.CreateClient().PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(email, ApiFactory.TestPassword), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task New_admin_needs_creator_code_but_manager_does_not()
    {
        var admin = await Staff.LoginAsync(api, await CreateAdminAsync());
        var adminRole = await Staff.RoleIdAsync(admin, "Адміністратор");
        var managerRole = await Staff.RoleIdAsync(admin, "Менеджер");

        var withoutSetup = await admin.PostAsJsonAsync("/api/v1/console/users", NewUser(adminRole), Ct);
        withoutSetup.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await withoutSetup.ProblemCodeAsync()).ShouldBe("staff.two_factor_setup_required");

        var key = await EnableAsync(admin);

        var noCode = await admin.PostAsJsonAsync("/api/v1/console/users", NewUser(adminRole), Ct);
        (await noCode.ProblemCodeAsync()).ShouldBe("staff.two_factor_required");
        var badCode = await admin.PostAsJsonAsync("/api/v1/console/users", NewUser(adminRole, "111111"), Ct);
        (await badCode.ProblemCodeAsync()).ShouldBe("staff.two_factor_invalid");

        var created = await (await admin.PostAsJsonAsync("/api/v1/console/users", NewUser(adminRole, Totp.Code(key)), Ct))
            .ReadAsync<StaffUserDto>(HttpStatusCode.Created);
        created.RoleName.ShouldBe("Адміністратор");
        created.TwoFactorEnabled.ShouldBeFalse();

        var manager = await (await admin.PostAsJsonAsync("/api/v1/console/users", NewUser(managerRole), Ct)).ReadAsync<StaffUserDto>(HttpStatusCode.Created);
        var promote = await admin.PutAsJsonAsync($"/api/v1/console/users/{manager.Id}", new UpdateStaffUserRequest(manager.DisplayName, adminRole), Ct);
        (await promote.ProblemCodeAsync()).ShouldBe("staff.two_factor_required");
        (await (await admin.PutAsJsonAsync($"/api/v1/console/users/{manager.Id}", new UpdateStaffUserRequest(manager.DisplayName, adminRole, Totp.Code(key)), Ct))
            .ReadAsync<StaffUserDto>()).RoleName.ShouldBe("Адміністратор");
    }

    [Fact]
    public async Task Admin_resets_two_factor_of_employee_who_lost_phone()
    {
        var adminEmail = await CreateAdminAsync();
        var admin = await Staff.LoginAsync(api, adminEmail);
        var adminKey = await EnableAsync(admin);
        var managerRole = await Staff.RoleIdAsync(admin, "Менеджер");
        var manager = await (await admin.PostAsJsonAsync("/api/v1/console/users", NewUser(managerRole), Ct)).ReadAsync<StaffUserDto>(HttpStatusCode.Created);
        var managerClient = await Staff.LoginAsync(api, manager.Email);
        await EnableAsync(managerClient);

        var list = await admin.ReadAsync<List<StaffUserDto>>("/api/v1/console/users");
        list.Single(u => u.Id == manager.Id).TwoFactorEnabled.ShouldBeTrue();

        var reset = await (await admin.PostAsJsonAsync($"/api/v1/console/users/{manager.Id}/two-factor/reset", new ResetStaffTwoFactorRequest(null), Ct))
            .ReadAsync<StaffUserDto>();
        reset.TwoFactorEnabled.ShouldBeFalse();
        (await api.CreateClient().PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(manager.Email, ApiFactory.TestPassword), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        var self = list.Single(u => u.Email == adminEmail);
        (await admin.PostAsJsonAsync($"/api/v1/console/users/{self.Id}/two-factor/reset", new ResetStaffTwoFactorRequest(Totp.Code(adminKey)), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    private static CreateStaffUserRequest NewUser(string roleId, string? code = null) =>
        new($"staff-{Guid.NewGuid():N}@tests.polivalko.local", "Новий працівник", roleId, ApiFactory.TestPassword, code);

    private static async Task<string> EnableAsync(HttpClient client)
    {
        var setup = await (await client.PostAsync("/api/v1/console/auth/two-factor/setup", null, Ct)).ReadAsync<TwoFactorSetupDto>();
        await (await client.PostAsJsonAsync("/api/v1/console/auth/two-factor/enable", new TwoFactorCodeRequest(Totp.Code(setup.SharedKey)), Ct))
            .ReadAsync<TwoFactorRecoveryCodesDto>();
        return setup.SharedKey;
    }

    private Task<string> CreateAdminAsync() =>
        api.WithScopeAsync(async services =>
        {
            var users = services.GetRequiredService<UserManager<StaffUser>>();
            var email = $"admin-{Guid.NewGuid():N}@tests.polivalko.local";
            var user = new StaffUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = "Адмін для 2FA" };
            (await users.CreateAsync(user, ApiFactory.TestPassword)).Succeeded.ShouldBeTrue();
            (await users.AddToRoleAsync(user, StaffRoles.Admin)).Succeeded.ShouldBeTrue();
            return email;
        });
}
