using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Domain;
using PoliValko.Console.Features.Accounting;
using PoliValko.Console.Features.Analytics;
using PoliValko.Identity.Features.Auth;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.IntegrationTests;

public sealed class RecommendationOfferTests(ApiFactory api)
{
    private const string Route = "/api/v1/console/accounting/recommendation-offers/";
    private sealed class Report(object payload) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(payload) });
    }

    [Fact]
    public async Task Issuing_declining_and_reserving_are_shared_atomic_and_retryable()
    {
        var ct = TestContext.Current.CancellationToken;
        var first = Guid.NewGuid();
        var next = Guid.NewGuid();
        var product = await api.AddProductAsync("ruchnyi-instrument","Пропозиція · ваговий товар",10,1.5m);
        var last = new DateOnly(2026,11,11);
        await api.WithDbAsync(db => db.Database.ExecuteSqlAsync($"""
            INSERT INTO accounting.partners(id,source_account,source_id,title,details)
            VALUES ({first},'rec-test',{first.ToString()},'A',jsonb_build_object()),({next},'rec-test',{next.ToString()},'B',jsonb_build_object())
            """,ct));
        var report = new { clients = new[] { first, next }.Select(id => new { id, items = new[]{
            new { id=product.Id, last, quantity=1.5m, price=10m, unit="кг", offerId=(Guid?)null } } }) };
        await using var host = api.WithWebHostBuilder(b => b.ConfigureServices(s =>
            s.AddHttpClient<BusinessAnalyticsClient>(h => h.BaseAddress = new Uri("http://analytics.test/"))
                .ConfigurePrimaryHttpMessageHandler(() => new Report(report))));
        using var staff = host.CreateClient();
        (await staff.PostAsJsonAsync("/api/v1/console/auth/login",new LoginRequest(ApiFactory.AdminEmail,ApiFactory.TestPassword),ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
        var csrf = await staff.ReadAsync<CsrfTokenDto>("/api/v1/console/auth/csrf");
        staff.DefaultRequestHeaders.Add("X-CSRF-TOKEN",csrf.Token);
        Task<HttpResponseMessage> Act(string path) => staff.PutAsJsonAsync(Route+path,new {},ct);
        Task<decimal> Reserved() => api.WithDbAsync(db => db.Set<ProductStock>().Where(s => s.ProductId == product.Id)
            .Select(s => s.ReservedQuantity).SingleAsync(ct));
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var input = new RecommendationOfferRequest(first,product.Id,last,90,1.5m,"кг",10m);
        (await staff.PutAsJsonAsync(Route+a,input with { Quantity=2 },ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await staff.PutAsJsonAsync(Route+a,input,ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await staff.PutAsJsonAsync(Route+a,input,ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Reserved()).ShouldBe(0);
        (await staff.PutAsJsonAsync(Route+b,input with { PartnerId=next },ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Act(a+"/decline")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(a+"/decline")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(a+"/accept")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await staff.PutAsJsonAsync(Route+b,input with { PartnerId=next },ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.WithDbAsync(db => db.Set<ProductStock>().Where(s=>s.ProductId==product.Id)
            .ExecuteUpdateAsync(v=>v.SetProperty(s=>s.Quantity,1m),ct));
        (await Act(b+"/accept")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Reserved()).ShouldBe(0);
        await api.WithDbAsync(db => db.Set<ProductStock>().Where(s=>s.ProductId==product.Id)
            .ExecuteUpdateAsync(v=>v.SetProperty(s=>s.Quantity,1.5m),ct));
        var accepts = await Task.WhenAll(Act(b+"/accept"), Act(b+"/accept"));
        accepts.ShouldAllBe(r=>r.StatusCode==HttpStatusCode.OK);
        (await Reserved()).ShouldBe(1.5m);
        (await Act(b+"/release")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Act(b+"/release")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await Reserved()).ShouldBe(0);
        using var admin = await Staff.AdminAsync(api);
        using var reader = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.AccountingView,
            PermissionKeys.ProductsView, PermissionKeys.ProductAnalyticsView, PermissionKeys.AccountingEdit);
        (await reader.PutAsJsonAsync(Route+b+"/accept",new {},ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }
}
