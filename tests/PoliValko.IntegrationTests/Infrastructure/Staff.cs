using System.Net;
using System.Net.Http.Json;
using PoliValko.Identity.Features.Auth;
using PoliValko.Infrastructure.Security;

namespace PoliValko.IntegrationTests;

internal static class Staff
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static async Task<HttpClient> LoginAsync(ApiFactory api, string email, string? password = null)
    {
        var client = await SignInAsync(api, email, password);
        var csrf = await client.GetFromJsonAsync<CsrfTokenDto>("/api/v1/console/auth/csrf", Ct);
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf!.Token);
        return client;
    }

    public static async Task<HttpClient> SignInAsync(ApiFactory api, string email, string? password = null)
    {
        var client = api.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(email, password ?? ApiFactory.TestPassword), Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        return client;
    }

    public static Task<HttpClient> AdminAsync(ApiFactory api) => LoginAsync(api, ApiFactory.AdminEmail);

    public static Task<HttpClient> ManagerAsync(ApiFactory api) => LoginAsync(api, ApiFactory.ManagerEmail);

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        if (response.StatusCode != expected)
        {
            throw new ShouldAssertException($"Очікували {expected}, отримали {response.StatusCode}: {await response.Content.ReadAsStringAsync(Ct)}");
        }

        return (await response.Content.ReadFromJsonAsync<T>(TestJson.Options, Ct))!;
    }

    public static async Task<T> ReadAsync<T>(this HttpClient client, string url) =>
        await (await client.GetAsync(url, Ct)).ReadAsync<T>();

    public static async Task<string?> ProblemCodeAsync(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))?.Code;

    public static Task<HttpResponseMessage> PostWithKeyAsync(this HttpClient client, string url, object body) =>
        client.SendAsync(
            new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent.Create(body, body.GetType(), options: TestJson.Options),
                Headers = { { "Idempotency-Key", Guid.NewGuid().ToString() } },
            },
            Ct);
}
