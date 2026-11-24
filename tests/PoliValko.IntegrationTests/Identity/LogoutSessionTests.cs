using System.Net;

namespace PoliValko.IntegrationTests;

// Signing out must end the session for good: a copy of the cookie (shared computer, a stolen cookie) stops working too.
public sealed class LogoutSessionTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_customer_who_signs_out_ends_every_session_of_the_account()
    {
        var email = Accounts.UniqueEmail();
        var (first, _) = await Accounts.RegisterAsync(api, email);
        var other = await Accounts.LoginAsync(api, email);
        (await other.GetAsync("/api/v1/account/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await first.PostAsync("/api/v1/account/logout", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await other.GetAsync("/api/v1/account/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Accounts.LoginAsync(api, email)).ShouldNotBeNull();
    }

    [Fact]
    public async Task A_staff_member_who_signs_out_ends_every_console_session_at_once()
    {
        var first = await Staff.LoginAsync(api, ApiFactory.ManagerEmail);
        var other = await Staff.SignInAsync(api, ApiFactory.ManagerEmail);
        (await other.GetAsync("/api/v1/console/auth/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        (await first.PostAsync("/api/v1/console/auth/logout", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await other.GetAsync("/api/v1/console/auth/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Staff.SignInAsync(api, ApiFactory.ManagerEmail)).ShouldNotBeNull();
    }
}
