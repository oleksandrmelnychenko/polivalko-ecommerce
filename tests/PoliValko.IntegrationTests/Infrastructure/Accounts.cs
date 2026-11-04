using System.Net;
using System.Net.Http.Json;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Features.Confirmation;
using PoliValko.Infrastructure.Security;

namespace PoliValko.IntegrationTests;

internal static class Accounts
{
    public const string Password = "Shopper-password-2026";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static string UniqueEmail(string prefix = "shopper") => $"{prefix}-{Guid.NewGuid():N}@tests.polivalko.local";

    public static async Task<HttpClient> AnonymousAsync(ApiFactory api)
    {
        var client = api.CreateClient();
        await RefreshCsrfAsync(client);
        return client;
    }

    public static async Task RefreshCsrfAsync(HttpClient client)
    {
        var csrf = await client.GetFromJsonAsync<CsrfTokenDto>("/api/v1/account/csrf", Ct);
        client.DefaultRequestHeaders.Remove(CsrfHeaders.Token);
        client.DefaultRequestHeaders.Add(CsrfHeaders.Token, csrf!.Token);
    }

    public static async Task<(HttpClient Client, CustomerMeDto Me)> RegisterAsync(ApiFactory api, string? email = null, string name = "Олена Покупчиня")
    {
        var client = await AnonymousAsync(api);
        var response = await client.PostAsJsonAsync(
            "/api/v1/account/register",
            new RegisterCustomerRequest(email ?? UniqueEmail(), Password, name, null),
            Ct);
        var me = await response.ReadAsync<CustomerMeDto>(HttpStatusCode.Created);
        await RefreshCsrfAsync(client);
        return (client, me);
    }

    public static async Task<HttpClient> LoginAsync(ApiFactory api, string email, string password = Password)
    {
        var client = await AnonymousAsync(api);
        var response = await client.PostAsJsonAsync("/api/v1/account/login", new CustomerLoginRequest(email, password), Ct);
        await response.ReadAsync<CustomerMeDto>();
        await RefreshCsrfAsync(client);
        return client;
    }

    public static async Task ConfirmEmailAsync(ApiFactory api, HttpClient client, string email)
    {
        var token = api.Mailer.LastToken(email, MailKind.EmailConfirmation);
        var response = await client.PostAsJsonAsync("/api/v1/account/email/confirm", new ConfirmEmailRequest(token), Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    public static Task<HttpResponseMessage> PostJsonAsync<T>(this HttpClient client, string url, T body) =>
        client.PostAsJsonAsync(url, body, TestJson.Options, Ct);

    public static Task<HttpResponseMessage> PutJsonAsync<T>(this HttpClient client, string url, T body) =>
        client.PutAsJsonAsync(url, body, TestJson.Options, Ct);
}
