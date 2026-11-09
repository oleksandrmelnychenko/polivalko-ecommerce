using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Features.Auth;
using PoliValko.Identity.Features.Auth;

namespace PoliValko.IntegrationTests;

public sealed class SessionCutoverTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task Legacy_sessions_are_rejected_but_fresh_signins_work(bool customer, bool chunked)
    {
        HttpResponseMessage login;
        if (customer)
        {
            var email = Accounts.UniqueEmail("cutover");
            var (registered, _) = await Accounts.RegisterAsync(api, email);
            registered.Dispose();
            using var client = await Accounts.AnonymousAsync(api);
            login = await client.PostAsJsonAsync("/api/v1/account/login", new CustomerLoginRequest(email, Accounts.Password), Ct);
        }
        else
        {
            using var client = api.CreateClient();
            login = await client.PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(ApiFactory.ManagerEmail, ApiFactory.TestPassword), Ct);
        }
        using var response = login;
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var scheme = customer ? CustomerClaims.AuthenticationType : IdentityConstants.ApplicationScheme;
        var options = api.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(scheme);
        var cookieName = options.Cookie.Name!;
        var currentCookie = response.Headers.GetValues("Set-Cookie").Single(h => h.StartsWith(cookieName + "=", StringComparison.Ordinal)).Split(';')[0];
        var ticket = options.TicketDataFormat.Unprotect(currentCookie[(cookieName.Length + 1)..]).ShouldNotBeNull();
        var legacyFormat = LegacyFormat(scheme);
        var legacyCookie = legacyFormat.Protect(ticket);
        legacyFormat.Unprotect(legacyCookie).ShouldNotBeNull(); // Valid ticket/key, only its session generation is old.

        var http = new DefaultHttpContext();
        new ChunkingCookieManager { ChunkSize = chunked ? 512 : null }
            .AppendResponseCookie(http, cookieName, legacyCookie, new CookieOptions());
        var oldCookies = http.Response.Headers.SetCookie.Select(h => h!.Split(';')[0]).ToArray();
        if (chunked) oldCookies.Length.ShouldBeGreaterThan(1);
        var endpoint = customer ? "/api/v1/account/me" : "/api/v1/console/auth/me";
        using var replay = api.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });
        using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
        request.Headers.Add("Cookie", string.Join("; ", oldCookies));
        using var rejected = await replay.SendAsync(request, Ct);
        rejected.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await rejected.ProblemCodeAsync()).ShouldBe("auth.unauthorized");
        rejected.Headers.Contains("Set-Cookie").ShouldBeFalse(); // No silent upgrade of an old session.

        using var fresh = new HttpRequestMessage(HttpMethod.Get, endpoint);
        fresh.Headers.Add("Cookie", currentCookie);
        using var accepted = await replay.SendAsync(fresh, Ct);
        accepted.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    public static TheoryData<string> AuxiliarySchemes => new()
    {
        IdentityConstants.ExternalScheme,
        IdentityConstants.TwoFactorRememberMeScheme,
        IdentityConstants.TwoFactorUserIdScheme,
    };

    [Theory]
    [MemberData(nameof(AuxiliarySchemes))]
    public void Auxiliary_identity_cookies_also_reject_the_legacy_generation(string scheme)
    {
        var ticket = new AuthenticationTicket(new System.Security.Claims.ClaimsPrincipal(new System.Security.Claims.ClaimsIdentity(scheme)), scheme);
        var format = api.Services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(scheme).TicketDataFormat;
        format.Unprotect(LegacyFormat(scheme).Protect(ticket)).ShouldBeNull();
        format.Unprotect(format.Protect(ticket)).ShouldNotBeNull();
    }

    private TicketDataFormat LegacyFormat(string scheme) => new(api.Services.GetRequiredService<IDataProtectionProvider>()
        .CreateProtector("Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationMiddleware", scheme, "v2"));
}
