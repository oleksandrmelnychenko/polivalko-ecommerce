using System.Net;
using System.Net.Http.Json;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Features.Console;
using PoliValko.Customers.Features.Recovery;
using PoliValko.Customers.Features.Profile;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ConsoleAccountApiTests(ApiFactory api)
{
    private const string Url = "/api/v1/console/accounts";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Accounts_are_listed_filtered_and_shown_with_orders_and_favorites()
    {
        var email = Accounts.UniqueEmail("console");
        var (client, me) = await Accounts.RegisterAsync(api, email, "Ірина Кабінетна");
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Шланг для кабінету в консолі", 410m, stock: 10);
        (await client.PutAsync($"/api/v1/account/favorites/{product.Id}", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var order = await (await new CheckoutApiTests(api).PostOrderAsync(
                CheckoutApiTests.Order(product.Id, 1, "410.00", CheckoutApiTests.UniquePhone()), Guid.NewGuid().ToString(), client))
            .ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var manager = await Staff.ManagerAsync(api);

        var row = (await manager.ReadAsync<PagedResponse<ConsoleAccountDto>>($"{Url}?q={Uri.EscapeDataString(email.ToUpperInvariant())}")).Items.ShouldHaveSingleItem();
        row.Id.ShouldBe(me.Id);
        row.Name.ShouldBe("Ірина Кабінетна");
        row.EmailConfirmed.ShouldBeFalse();
        row.LockedOut.ShouldBeFalse();
        row.OrdersCount.ShouldBe(1);
        (await manager.ReadAsync<PagedResponse<ConsoleAccountDto>>($"{Url}?q=Кабінетна&status=unconfirmed&pageSize=100")).Items.Select(a => a.Id).ShouldContain(me.Id);
        (await manager.ReadAsync<PagedResponse<ConsoleAccountDto>>($"{Url}?q={Uri.EscapeDataString(email)}&status=confirmed")).Items.ShouldBeEmpty();

        await Accounts.ConfirmEmailAsync(api, client, email);
        (await manager.ReadAsync<PagedResponse<ConsoleAccountDto>>($"{Url}?q={Uri.EscapeDataString(email)}&status=confirmed")).Items.ShouldHaveSingleItem();

        var details = await manager.ReadAsync<ConsoleAccountDetailsDto>($"{Url}/{me.Id}");
        details.Email.ShouldBe(email);
        details.EmailConfirmed.ShouldBeTrue();
        details.FavoritesCount.ShouldBe(1);
        details.Addresses.ShouldBeEmpty();
        details.Blocked.ShouldBeFalse();
        var recent = details.Orders.ShouldHaveSingleItem();
        recent.Number.ShouldBe(order.Number);
        recent.Status.ShouldBe("new");
        recent.Total.ShouldBe(new MoneyDto("410.00", "UAH"));

        (await manager.GetAsync($"{Url}?status=vip", Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var missing = await manager.GetAsync($"{Url}/{Guid.NewGuid()}", Ct);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await missing.ProblemCodeAsync()).ShouldBe("accounts.not_found");
    }

    [Fact]
    public async Task Locking_ends_sessions_and_blocks_login_until_unlocked()
    {
        var email = Accounts.UniqueEmail("locked");
        var (client, me) = await Accounts.RegisterAsync(api, email);
        var admin = await Staff.AdminAsync(api);

        var locked = await (await admin.PostAsJsonAsync($"{Url}/{me.Id}/lock", new SetAccountLockRequest(true), TestJson.Options, Ct))
            .ReadAsync<ConsoleAccountDto>();
        locked.LockedOut.ShouldBeTrue();
        for (var attempt = 0; attempt < 3; attempt++)
        {
            (await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Заблокований", null), Ct))
                .StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        }
        (await admin.ReadAsync<ConsoleAccountDetailsDto>($"{Url}/{me.Id}")).Blocked.ShouldBeTrue();
        (await admin.ReadAsync<PagedResponse<ConsoleAccountDto>>($"{Url}?q={Uri.EscapeDataString(email)}&status=locked")).Items.ShouldHaveSingleItem();

        (await client.GetAsync("/api/v1/account/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var anonymous = await Accounts.AnonymousAsync(api);
        var denied = await anonymous.PostAsJsonAsync("/api/v1/account/login", new CustomerLoginRequest(email, Accounts.Password), Ct);
        denied.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await denied.ProblemCodeAsync()).ShouldBe("account.blocked");
        var wrong = await anonymous.PostAsJsonAsync("/api/v1/account/login", new CustomerLoginRequest(email, "Wrong-password-2026"), Ct);
        wrong.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        (await (await admin.PostAsJsonAsync($"{Url}/{me.Id}/lock", new SetAccountLockRequest(false), TestJson.Options, Ct))
            .ReadAsync<ConsoleAccountDto>()).LockedOut.ShouldBeFalse();
        var back = await Accounts.LoginAsync(api, email);
        (await back.ReadAsync<CustomerMeDto>("/api/v1/account/me")).Id.ShouldBe(me.Id);

        (await admin.PostAsJsonAsync($"{Url}/{me.Id}/lock", new { }, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostAsJsonAsync($"{Url}/{Guid.NewGuid()}/lock", new SetAccountLockRequest(true), TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Password_reset_sends_a_working_link()
    {
        var email = Accounts.UniqueEmail("reset");
        var (_, me) = await Accounts.RegisterAsync(api, email);
        var admin = await Staff.AdminAsync(api);

        (await admin.PostAsync($"{Url}/{me.Id}/password-reset", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var token = api.Mailer.LastToken(email, MailKind.PasswordReset);
        var anonymous = await Accounts.AnonymousAsync(api);
        (await anonymous.PostAsJsonAsync("/api/v1/account/password/reset", new ResetCustomerPasswordRequest(token, "Staff-reset-password-2026"), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await Accounts.LoginAsync(api, email, "Staff-reset-password-2026");

        (await admin.PostAsync($"{Url}/{Guid.NewGuid()}/password-reset", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Viewing_needs_customers_view_and_changes_need_accounts_manage()
    {
        var (_, me) = await Accounts.RegisterAsync(api);
        var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync($"{Url}/{me.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var denied = await manager.PostAsJsonAsync($"{Url}/{me.Id}/lock", new SetAccountLockRequest(true), TestJson.Options, Ct);
        denied.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await denied.ProblemCodeAsync()).ShouldBe("auth.forbidden");
        (await manager.PostAsync($"{Url}/{me.Id}/password-reset", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var admin = await Staff.AdminAsync(api);
        var support = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.CustomersView, PermissionKeys.CustomerAccountsManage);
        (await support.PostAsJsonAsync($"{Url}/{me.Id}/lock", new SetAccountLockRequest(false), TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var outsider = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.OrdersView);
        (await outsider.GetAsync(Url, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
