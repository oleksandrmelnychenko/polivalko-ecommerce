using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Features.Confirmation;
using PoliValko.Customers.Features.Profile;
using PoliValko.Customers.Features.Recovery;
using PoliValko.Infrastructure.Security;

namespace PoliValko.IntegrationTests;

public sealed class AccountApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Register_signs_in_and_logout_then_login_restore_the_session()
    {
        var email = Accounts.UniqueEmail();
        var (client, created) = await Accounts.RegisterAsync(api, $"  {email}  ");

        created.Email.ShouldBe(email);
        created.EmailConfirmed.ShouldBeFalse();
        created.Name.ShouldBe("Олена Покупчиня");
        created.Phone.ShouldBeNull();
        api.Mailer.To(email, MailKind.EmailConfirmation).ShouldHaveSingleItem().Link.ShouldContain("/account/confirm-email?token=");
        (await client.ReadAsync<CustomerMeDto>("/api/v1/account/me")).Id.ShouldBe(created.Id);

        (await client.PostAsync("/api/v1/account/logout", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var signedOut = await client.GetAsync("/api/v1/account/me", Ct);
        signedOut.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await signedOut.ProblemCodeAsync()).ShouldBe("auth.unauthorized");

        await Accounts.RefreshCsrfAsync(client);
        var login = await client.PostAsJsonAsync("/api/v1/account/login", new CustomerLoginRequest(email.ToUpperInvariant(), Accounts.Password), Ct);
        (await login.ReadAsync<CustomerMeDto>()).Id.ShouldBe(created.Id);
        (await client.ReadAsync<CustomerMeDto>("/api/v1/account/me")).Email.ShouldBe(email);
    }

    [Fact]
    public async Task Duplicate_email_is_rejected_regardless_of_case()
    {
        var email = Accounts.UniqueEmail();
        await Accounts.RegisterAsync(api, email);
        var client = await Accounts.AnonymousAsync(api);

        var response = await client.PostAsJsonAsync(
            "/api/v1/account/register",
            new RegisterCustomerRequest(email.ToUpperInvariant(), Accounts.Password, "Інший Покупець", null),
            Ct);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!;
        problem.Code.ShouldBe("validation.failed");
        problem.Errors!.Keys.ShouldBe(["email"]);
    }

    [Fact]
    public async Task Registration_validates_every_field()
    {
        var client = await Accounts.AnonymousAsync(api);

        var invalid = await client.PostAsJsonAsync("/api/v1/account/register", new RegisterCustomerRequest("Олена <not-an-email>", "short", "О", "12345"), Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.Order().ShouldBe(["email", "name", "password", "phone"]);

        var email = Accounts.UniqueEmail();
        var sameAsEmail = await client.PostAsJsonAsync("/api/v1/account/register", new RegisterCustomerRequest(email, email.ToUpperInvariant(), "Олена", null), Ct);
        sameAsEmail.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await sameAsEmail.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!["password"].ShouldBe(["Пароль не може збігатися з email."]);
        api.Mailer.To(email, MailKind.EmailConfirmation).ShouldBeEmpty();
    }

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account_behind_the_same_error()
    {
        var email = Accounts.UniqueEmail();
        var (_, me) = await Accounts.RegisterAsync(api, email);
        var client = await Accounts.AnonymousAsync(api);

        for (var attempt = 0; attempt < Customer.MaxFailedLogins; attempt++)
        {
            await ShouldBeRejectedAsync(client, email, "wrong-password-1");
        }

        await ShouldBeRejectedAsync(client, email, Accounts.Password);
        await ShouldBeRejectedAsync(client, Accounts.UniqueEmail(), Accounts.Password);
        var lockout = await api.WithDbAsync(db => db.Set<Customer>().Where(c => c.Id == me.Id).Select(c => c.LockoutEnd).SingleAsync(Ct));
        lockout.ShouldNotBeNull().ShouldBeGreaterThan(DateTimeOffset.UtcNow.AddMinutes(14));

        await api.WithDbAsync(db => db.Set<Customer>().Where(c => c.Id == me.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.LockoutEnd, DateTimeOffset.UtcNow.AddSeconds(-1)), Ct));
        var login = await client.PostAsJsonAsync("/api/v1/account/login", new CustomerLoginRequest(email, Accounts.Password), Ct);
        (await login.ReadAsync<CustomerMeDto>()).Id.ShouldBe(me.Id);
    }

    [Fact]
    public async Task Account_mutations_require_the_csrf_header()
    {
        var bare = api.CreateClient();
        var email = Accounts.UniqueEmail();
        await ShouldNeedCsrfAsync(await bare.PostAsJsonAsync("/api/v1/account/register", new RegisterCustomerRequest(email, Accounts.Password, "Олена", null), Ct));
        await ShouldNeedCsrfAsync(await bare.PostAsJsonAsync("/api/v1/account/login", new CustomerLoginRequest(email, Accounts.Password), Ct));
        await ShouldNeedCsrfAsync(await bare.PostAsJsonAsync("/api/v1/account/password/forgot", new ForgotPasswordRequest(email), Ct));
        await ShouldNeedCsrfAsync(await bare.PostAsJsonAsync("/api/v1/account/email/confirm", new ConfirmEmailRequest("token"), Ct));

        var (client, _) = await Accounts.RegisterAsync(api);
        var token = client.DefaultRequestHeaders.GetValues(CsrfHeaders.Token).Single();
        client.DefaultRequestHeaders.Remove(CsrfHeaders.Token);
        await ShouldNeedCsrfAsync(await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Олена", null), Ct));
        await ShouldNeedCsrfAsync(await client.PostAsJsonAsync("/api/v1/account/password", new ChangeCustomerPasswordRequest(Accounts.Password, "Another-password-1"), Ct));
        await ShouldNeedCsrfAsync(await client.PutAsync($"/api/v1/account/favorites/{Guid.NewGuid()}", null, Ct));
        await ShouldNeedCsrfAsync(await client.PostAsync("/api/v1/account/logout", null, Ct));

        client.DefaultRequestHeaders.Add(CsrfHeaders.Token, token);
        (await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Олена", null), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var stale = await Accounts.AnonymousAsync(api);
        var register = await stale.PostAsJsonAsync(
            "/api/v1/account/register",
            new RegisterCustomerRequest(Accounts.UniqueEmail(), Accounts.Password, "Олена", null),
            Ct);
        register.StatusCode.ShouldBe(HttpStatusCode.Created);
        await ShouldNeedCsrfAsync(await stale.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Олена", null), Ct));
        await Accounts.RefreshCsrfAsync(stale);
        (await stale.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Олена", null), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Profile_update_normalizes_the_phone_and_validates_fields()
    {
        var (client, _) = await Accounts.RegisterAsync(api);

        var updated = await (await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("  Олена Нова  ", "067 123 45 67"), Ct))
            .ReadAsync<CustomerMeDto>();
        updated.Name.ShouldBe("Олена Нова");
        updated.Phone.ShouldBe("+380671234567");
        (await client.ReadAsync<CustomerMeDto>("/api/v1/account/me")).ShouldBe(updated);

        var invalid = await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("О", "123"), Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.Order().ShouldBe(["name", "phone"]);

        var cleared = await (await client.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Олена Нова", null), Ct))
            .ReadAsync<CustomerMeDto>();
        cleared.Phone.ShouldBeNull();
    }

    [Fact]
    public async Task Password_change_keeps_this_session_and_ends_the_others()
    {
        var email = Accounts.UniqueEmail();
        var (first, _) = await Accounts.RegisterAsync(api, email);
        var second = await Accounts.LoginAsync(api, email);
        (await second.GetAsync("/api/v1/account/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

        var wrong = await first.PostAsJsonAsync("/api/v1/account/password", new ChangeCustomerPasswordRequest("not-the-password", "Another-password-1"), Ct);
        wrong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await wrong.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["currentPassword"]);

        var changed = await first.PostAsJsonAsync("/api/v1/account/password", new ChangeCustomerPasswordRequest(Accounts.Password, "Another-password-1"), Ct);
        changed.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        (await first.GetAsync("/api/v1/account/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await first.PutAsJsonAsync("/api/v1/account/profile", new UpdateProfileRequest("Олена", null), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await second.GetAsync("/api/v1/account/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var anonymous = await Accounts.AnonymousAsync(api);
        await ShouldBeRejectedAsync(anonymous, email, Accounts.Password);
        (await Accounts.LoginAsync(api, email, "Another-password-1")).ShouldNotBeNull();
    }

    [Fact]
    public async Task Password_reset_uses_a_single_use_token_and_clears_the_lockout()
    {
        var email = Accounts.UniqueEmail();
        var (session, me) = await Accounts.RegisterAsync(api, email);
        var client = await Accounts.AnonymousAsync(api);
        for (var attempt = 0; attempt < Customer.MaxFailedLogins; attempt++)
        {
            await ShouldBeRejectedAsync(client, email, "wrong-password-1");
        }

        var unknown = Accounts.UniqueEmail();
        (await client.PostAsJsonAsync("/api/v1/account/password/forgot", new ForgotPasswordRequest(unknown), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        api.Mailer.To(unknown, MailKind.PasswordReset).ShouldBeEmpty();

        (await client.PostAsJsonAsync("/api/v1/account/password/forgot", new ForgotPasswordRequest(email.ToUpperInvariant()), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var reset = api.Mailer.To(email, MailKind.PasswordReset).ShouldHaveSingleItem();
        reset.Link.ShouldContain("/account/reset-password?token=");
        var token = api.Mailer.LastToken(email, MailKind.PasswordReset);

        var weak = await client.PostAsJsonAsync("/api/v1/account/password/reset", new ResetCustomerPasswordRequest(token, "short"), Ct);
        weak.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await weak.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["newPassword"]);

        (await client.PostAsJsonAsync("/api/v1/account/password/reset", new ResetCustomerPasswordRequest(token, "Reset-password-2026"), Ct))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var reused = await client.PostAsJsonAsync("/api/v1/account/password/reset", new ResetCustomerPasswordRequest(token, "Reset-password-2027"), Ct);
        reused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await reused.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["token"]);

        (await session.GetAsync("/api/v1/account/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await Accounts.LoginAsync(api, email, "Reset-password-2026")).ShouldNotBeNull();

        (await client.PostAsJsonAsync("/api/v1/account/password/forgot", new ForgotPasswordRequest(email), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var expiring = api.Mailer.LastToken(email, MailKind.PasswordReset);
        var hash = CustomerToken.Hash(expiring);
        await api.WithDbAsync(db => db.Set<CustomerToken>().Where(t => t.TokenHash == hash)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, DateTimeOffset.UtcNow.AddSeconds(-1)), Ct));
        var expired = await client.PostAsJsonAsync("/api/v1/account/password/reset", new ResetCustomerPasswordRequest(expiring, "Reset-password-2028"), Ct);
        expired.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await expired.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["token"]);
        (await api.WithDbAsync(db => db.Set<Customer>().Where(c => c.Id == me.Id).Select(c => c.FailedLoginCount).SingleAsync(Ct))).ShouldBe(0);
    }

    [Fact]
    public async Task Confirmation_token_is_single_use()
    {
        var email = Accounts.UniqueEmail();
        var (client, _) = await Accounts.RegisterAsync(api, email);
        var token = api.Mailer.LastToken(email, MailKind.EmailConfirmation);

        (await client.PostAsJsonAsync("/api/v1/account/email/confirm", new ConfirmEmailRequest(token), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.ReadAsync<CustomerMeDto>("/api/v1/account/me")).EmailConfirmed.ShouldBeTrue();

        var reused = await client.PostAsJsonAsync("/api/v1/account/email/confirm", new ConfirmEmailRequest(token), Ct);
        reused.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await reused.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["token"]);

        (await client.PostAsync("/api/v1/account/email/resend", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        api.Mailer.To(email, MailKind.EmailConfirmation).Count.ShouldBe(1);
    }

    [Fact]
    public async Task Resend_sends_a_fresh_confirmation_link()
    {
        var email = Accounts.UniqueEmail();
        var (client, _) = await Accounts.RegisterAsync(api, email);
        var first = api.Mailer.LastToken(email, MailKind.EmailConfirmation);

        (await client.PostAsync("/api/v1/account/email/resend", null, Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        var second = api.Mailer.LastToken(email, MailKind.EmailConfirmation);
        second.ShouldNotBe(first);

        var anonymous = await Accounts.AnonymousAsync(api);
        (await anonymous.PostAsJsonAsync("/api/v1/account/email/confirm", new ConfirmEmailRequest(second), Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.ReadAsync<CustomerMeDto>("/api/v1/account/me")).EmailConfirmed.ShouldBeTrue();
    }

    [Fact]
    public async Task Customer_and_staff_cookies_do_not_cross()
    {
        var (customer, _) = await Accounts.RegisterAsync(api);
        var consoleOrders = await customer.GetAsync("/api/v1/console/orders", Ct);
        consoleOrders.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await consoleOrders.ProblemCodeAsync()).ShouldBe("auth.unauthorized");
        (await customer.GetAsync("/api/v1/console/auth/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var staff = await Staff.AdminAsync(api);
        (await staff.GetAsync("/api/v1/console/auth/me", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var accountMe = await staff.GetAsync("/api/v1/account/me", Ct);
        accountMe.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await accountMe.ProblemCodeAsync()).ShouldBe("auth.unauthorized");
        (await staff.GetAsync("/api/v1/account/orders", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await staff.GetAsync("/api/v1/account/favorites/ids", Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static async Task ShouldBeRejectedAsync(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/v1/account/login", new CustomerLoginRequest(email, password), Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await response.ProblemCodeAsync()).ShouldBe("account.invalid_credentials");
    }

    private static async Task ShouldNeedCsrfAsync(HttpResponseMessage response)
    {
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.ProblemCodeAsync()).ShouldBe("auth.csrf_invalid");
    }
}
