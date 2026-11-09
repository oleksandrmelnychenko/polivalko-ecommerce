using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Infrastructure.Settings;
using PoliValko.Navkolo.Features.Settings;
using PoliValko.Navkolo.Integrations.NavkoloApi;

namespace PoliValko.IntegrationTests;

public sealed class NavkoloSettingsApiTests(ApiFactory api)
{
    private const string Path = "/api/v1/console/settings/navkolo";
    private const string Store = "bb2859dc-ed34-4803-80e7-3ddfa809fe81";
    private const string Key = "test-navkolo-secret-never-return";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Secret_settings_require_explicit_permission_and_csrf()
    {
        using var anonymous = api.CreateClient();
        (await anonymous.GetAsync(Path, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        using var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync(Path, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.PostAsJsonAsync(Path + "/check", new CheckNavkoloRequest(Key), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        using var admin = await Staff.AdminAsync(api);
        admin.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        // Use the actual configured header, not an assumed spelling.
        admin.DefaultRequestHeaders.Remove(PoliValko.Infrastructure.Security.CsrfHeaders.Token);
        (await admin.PutAsJsonAsync(Path, new SaveNavkoloConnectionRequest(null, false, Key, false, null), Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Check_save_rotate_and_clear_are_encrypted_dynamic_and_do_not_fallback_to_environment()
    {
        var fake = new Provider();
        await using var host = api.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Navkolo:Mode", "Disabled");
            builder.UseSetting("Navkolo:ApiKey", "environment-secret");
            builder.ConfigureServices(services => services.AddHttpClient("DNTrade").ConfigurePrimaryHttpMessageHandler(() => fake));
        });
        using var admin = host.CreateClient();
        (await admin.PostAsJsonAsync("/api/v1/console/auth/login", new { email = ApiFactory.AdminEmail, password = ApiFactory.TestPassword }, Ct)).EnsureSuccessStatusCode();
        var csrf = await admin.GetFromJsonAsync<PoliValko.Infrastructure.Security.CsrfTokenDto>("/api/v1/console/auth/csrf", Ct);
        admin.DefaultRequestHeaders.Add(PoliValko.Infrastructure.Security.CsrfHeaders.Token, csrf!.Token);
        try
        {
            var original = await admin.ReadAsync<NavkoloConnectionDto>(Path);
            original.Revision.ShouldBeNull(); original.HasKey.ShouldBeTrue();
            var checkedResponse = await admin.PostAsJsonAsync(Path + "/check", new CheckNavkoloRequest(Key), Ct);
            var check = await checkedResponse.ReadAsync<CheckNavkoloDto>();
            check.Stores.ShouldContain(s => s.Id == Store && s.Name == "Буча");
            (await admin.ReadAsync<NavkoloConnectionDto>(Path)).Revision.ShouldBeNull();
            var save = new SaveNavkoloConnectionRequest(null, true, Key, false, Store, 9);
            var response = await admin.PutAsJsonAsync(Path, save, Ct);
            (await response.Content.ReadAsStringAsync(Ct)).ShouldNotContain(Key);
            var saved = await response.ReadAsync<NavkoloConnectionDto>();
            saved.Mode.ShouldBe("DNTrade"); saved.HasKey.ShouldBeTrue(); saved.StoreName.ShouldBe("Буча"); saved.VerifiedAt.ShouldNotBeNull();
            response.Headers.CacheControl!.NoStore.ShouldBeTrue();
            var ciphertext = await api.WithDbAsync(db => db.Set<PlatformSetting>().AsNoTracking().Where(s => s.Key == NavkoloSettings.Key).Select(s => s.Value).SingleAsync(Ct));
            ciphertext.ShouldNotContain(Key);
            await using (var scope = host.Services.CreateAsyncScope())
            {
                var runtime = await scope.ServiceProvider.GetRequiredService<NavkoloSettings>().LoadAsync(Ct);
                runtime.Mode.ShouldBe("DNTrade"); runtime.ApiKey.ShouldBe(Key);
                (await scope.ServiceProvider.GetRequiredService<INavkoloClient>().GetCatalogAsync(Ct)).ShouldBeEmpty();
                fake.LastKey.ShouldBe(Key);
            }
            // A second host has an independent DI container and key-ring cache, like Worker.
            await using (var other = api.WithWebHostBuilder(_ => { }))
            await using (var scope = other.Services.CreateAsyncScope())
                (await scope.ServiceProvider.GetRequiredService<NavkoloSettings>().LoadAsync(Ct)).ApiKey.ShouldBe(Key);

            (await admin.PutAsJsonAsync(Path, save, Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
            var bad = await admin.PutAsJsonAsync(Path, save with { Revision = saved.Revision, ApiKey = "rejected-key" }, Ct);
            bad.StatusCode.ShouldBe(HttpStatusCode.BadGateway);
            (await bad.Content.ReadAsStringAsync(Ct)).ShouldNotContain("rejected-key");
            (await admin.ReadAsync<NavkoloConnectionDto>(Path)).Revision.ShouldBe(saved.Revision);
            (await admin.PutAsJsonAsync(Path, save with { Revision = saved.Revision, StoreId = Guid.NewGuid().ToString() }, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            saved = await (await admin.PutAsJsonAsync(Path, save with { Revision = saved.Revision, ApiKey = Key + "-rotated" }, Ct)).ReadAsync<NavkoloConnectionDto>();
            saved = await (await admin.PutAsJsonAsync(Path, save with { Revision = saved.Revision, ApiKey = null }, Ct)).ReadAsync<NavkoloConnectionDto>();
            fake.LastKey.ShouldBe(Key + "-rotated");
            var audit = await admin.GetStringAsync("/api/v1/console/audit?entityType=NavkoloSettings", Ct);
            audit.ShouldNotContain(Key); audit.ShouldNotContain("environment-secret");
            var cleared = await (await admin.PutAsJsonAsync(Path, new SaveNavkoloConnectionRequest(saved.Revision, false, null, true, null), Ct)).ReadAsync<NavkoloConnectionDto>();
            cleared.Mode.ShouldBe("Disabled"); cleared.HasKey.ShouldBeFalse();
            (await admin.PostAsJsonAsync(Path + "/check", new CheckNavkoloRequest(null), Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await admin.PostAsJsonAsync(Path + "/check", new CheckNavkoloRequest("bad\nkey"), Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        }
        finally { await api.WithDbAsync(db => db.Set<PlatformSetting>().Where(s => s.Key == NavkoloSettings.Key).ExecuteDeleteAsync(Ct)); }
    }

    private sealed class Provider : HttpMessageHandler
    {
        public string? LastKey { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            request.RequestUri!.Host.ShouldBe("api.dntrade.com.ua");
            LastKey = request.Headers.GetValues("ApiKey").Single();
            if (LastKey == "rejected-key") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("rejected-key must never be returned") });
            if (request.RequestUri.AbsolutePath == "/orders/statuslist") return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("{\"status\":1,\"data\":[{\"id\":9,\"title\":\"Скасоване\"}]}", Encoding.UTF8, "application/json") });
            var body = request.RequestUri.AbsolutePath == "/products/stores"
                ? $$"""{"status":1,"stores":[{"id":"{{Store}}","title":"Буча"},{"id":"3473a276-be51-4837-8e7e-2cc1437f0a51","title":"Другий склад"}]}"""
                : "{\"status\":1,\"products\":[]}";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }
}
