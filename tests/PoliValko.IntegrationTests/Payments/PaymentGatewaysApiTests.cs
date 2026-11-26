using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Delivery.Contracts;
using PoliValko.Infrastructure.Settings;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Features.Checkout;
using PoliValko.Payments.Features.Settings;
using PoliValko.Payments.Integrations.LiqPay;

namespace PoliValko.IntegrationTests;

/// <summary>Banks for online payment are set in the console: keys stay encrypted, the buyer picks a bank.</summary>
// Shares the stored payment settings with PaymentSettingsApiTests, so the two never run at the same time.
[Collection("Payment settings")]
public sealed class PaymentGatewaysApiTests(ApiFactory api)
{
    private const string Path = "/api/v1/console/settings/payments/gateways";
    private const string PublicKey = "sandbox_i-test-shop";
    private const string PrivateKey = "sandbox_private-never-returned";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Keys_need_their_own_permission()
    {
        using var anonymous = api.CreateClient();
        (await anonymous.GetAsync(Path, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        using var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync(Path, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.PostAsJsonAsync(Path + "/check", new CheckPaymentGatewayRequest("liqpay", null, PublicKey, PrivateKey), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task LiqPay_set_in_the_console_takes_payment_and_replaces_an_open_invoice_of_another_bank()
    {
        var liqPay = new FakeLiqPay();
        await using var host = api.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.AddHttpClient(PaymentGatewayEndpoints.CheckClient).ConfigurePrimaryHttpMessageHandler(() => liqPay);
            services.AddHttpClient<LiqPayPaymentProvider>().ConfigurePrimaryHttpMessageHandler(() => liqPay);
        }));
        using var admin = host.CreateClient();
        (await admin.PostAsJsonAsync("/api/v1/console/auth/login", new { email = ApiFactory.AdminEmail, password = ApiFactory.TestPassword }, Ct)).EnsureSuccessStatusCode();
        var csrf = await admin.GetFromJsonAsync<PoliValko.Infrastructure.Security.CsrfTokenDto>("/api/v1/console/auth/csrf", Ct);
        admin.DefaultRequestHeaders.Add(PoliValko.Infrastructure.Security.CsrfHeaders.Token, csrf!.Token);
        try
        {
            var original = await admin.ReadAsync<PaymentGatewaysDto>(Path);
            original.SandboxEnabled.ShouldBeTrue();
            original.LiqPay.HasPrivateKey.ShouldBeFalse();

            var walletWithoutBank = await admin.PutAsJsonAsync(Path, Save(original.Revision, liqPay: false, wallets: true), Ct);
            walletWithoutBank.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

            var check = await (await admin.PostAsJsonAsync(Path + "/check", new CheckPaymentGatewayRequest("liqpay", null, PublicKey, PrivateKey), Ct))
                .ReadAsync<CheckPaymentGatewayDto>();
            check.Message.ShouldContain("sandbox_");

            var response = await admin.PutAsJsonAsync(Path, Save(original.Revision, liqPay: true, wallets: true), Ct);
            var text = await response.Content.ReadAsStringAsync(Ct);
            text.ShouldNotContain(PrivateKey);
            var saved = await response.ReadAsync<PaymentGatewaysDto>();
            saved.Source.ShouldBe("console");
            saved.LiqPay.HasPrivateKey.ShouldBeTrue();
            saved.LiqPay.VerifiedAt.ShouldNotBeNull();
            saved.Options.Select(o => o.Code).ShouldBe(["sandbox", "liqpay", "wallet"]);
            (await api.WithDbAsync(db => db.Set<PlatformSetting>().SingleAsync(s => s.Key == "payments.gateways.v1", Ct))).Value.ShouldNotContain(PrivateKey);

            (await admin.PutAsJsonAsync(Path, Save(original.Revision, liqPay: true, wallets: true), Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);

            using var buyer = host.CreateClient();
            var options = await buyer.ReadAsync<List<PaymentOptionDto>>("/api/v1/payments/options");
            options.Select(o => o.Code).ShouldBe(["sandbox", "liqpay", "wallet"]);

            var order = await CardOrderAsync(buyer, 640m);
            var sandbox = await StartAsync(buyer, order, null);
            var bank = await StartAsync(buyer, order, "liqpay");

            bank.PaymentId.ShouldNotBe(sandbox.PaymentId);
            bank.PageUrl.ShouldStartWith("https://www.liqpay.ua/api/3/checkout?data=");
            var withdrawn = await api.WithDbAsync(db => db.Set<Payment>().AsNoTracking().SingleAsync(p => p.Id == sandbox.PaymentId, Ct));
            withdrawn.Status.ShouldBe(PaymentAttemptStatus.Expired);
            withdrawn.FailureReason.ShouldBe(StartPayment.SwitchedReason);
            (await StartAsync(buyer, order, "wallet")).PaymentId.ShouldBe(bank.PaymentId);

            var data = LiqPayPaymentProvider.Encode(new JsonObject
            {
                ["public_key"] = PublicKey,
                ["order_id"] = bank.PaymentId.ToString("N"),
                ["status"] = "sandbox",
                ["amount"] = 640,
                ["end_date"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            });
            var forged = await buyer.PostAsync("/api/v1/payments/webhooks/liqpay", Form(data, LiqPayPaymentProvider.Sign("wrong", data, LiqPaySignatures.Sha1)), Ct);
            forged.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            var webhook = await buyer.PostAsync("/api/v1/payments/webhooks/liqpay", Form(data, LiqPayPaymentProvider.Sign(PrivateKey, data, LiqPaySignatures.Sha1)), Ct);
            webhook.StatusCode.ShouldBe(HttpStatusCode.OK);
            (await api.WithDbAsync(db => db.Set<Payment>().AsNoTracking().SingleAsync(p => p.Id == bank.PaymentId, Ct))).Status.ShouldBe(PaymentAttemptStatus.Succeeded);
        }
        finally
        {
            await api.WithDbAsync(db => db.Set<PlatformSetting>().Where(s => s.Key == "payments.gateways.v1").ExecuteDeleteAsync(Ct));
        }
    }

    [Fact]
    public async Task Mono_uses_the_server_token_until_the_console_saves_one_and_test_keys_stay_off_a_live_server()
    {
        var mono = new FakeMono();
        await using var host = api.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Payments:Provider", "Mono");
            builder.UseSetting("Payments:AllowSandbox", "false");
            builder.UseSetting("Payments:Mono:Token", "server-token");
            builder.UseSetting("Payments:Mono:BaseUrl", "https://mono.test");
            builder.ConfigureServices(services =>
            {
                services.AddHttpClient(PaymentGatewayEndpoints.CheckClient).ConfigurePrimaryHttpMessageHandler(() => mono);
                services.AddHttpClient<PoliValko.Payments.Integrations.Mono.MonoPaymentProvider>().ConfigurePrimaryHttpMessageHandler(() => mono);
            });
        });
        using var admin = host.CreateClient();
        (await admin.PostAsJsonAsync("/api/v1/console/auth/login", new { email = ApiFactory.AdminEmail, password = ApiFactory.TestPassword }, Ct)).EnsureSuccessStatusCode();
        var csrf = await admin.GetFromJsonAsync<PoliValko.Infrastructure.Security.CsrfTokenDto>("/api/v1/console/auth/csrf", Ct);
        admin.DefaultRequestHeaders.Add(PoliValko.Infrastructure.Security.CsrfHeaders.Token, csrf!.Token);
        try
        {
            using var buyer = host.CreateClient();
            (await buyer.ReadAsync<List<PaymentOptionDto>>("/api/v1/payments/options")).Select(o => o.Code).ShouldBe(["mono"]);
            var first = await StartAsync(buyer, await CardOrderAsync(buyer, 650m), null);
            first.PageUrl.ShouldStartWith("https://pay.mbnk.biz/");
            mono.Tokens.ShouldBe(["server-token"]);

            var original = await admin.ReadAsync<PaymentGatewaysDto>(Path);
            original.Source.ShouldBe("environment");
            original.Mono.HasToken.ShouldBeTrue();
            var testKeys = await admin.PutAsJsonAsync(Path, new SavePaymentGatewaysRequest(
                original.Revision, true, null, false, true, PublicKey, PrivateKey, false, false, "mono"), Ct);
            testKeys.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await testKeys.Content.ReadAsStringAsync(Ct)).ShouldContain("sandbox_");

            var saved = await (await admin.PutAsJsonAsync(Path, new SavePaymentGatewaysRequest(
                original.Revision, true, "console-token", false, false, null, null, false, false, "mono"), Ct)).ReadAsync<PaymentGatewaysDto>();
            saved.Options.Select(o => o.Code).ShouldBe(["mono"]);
            mono.Tokens.Last().ShouldBe("console-token");

            await StartAsync(buyer, await CardOrderAsync(buyer, 660m), "mono");
            mono.Tokens.Last().ShouldBe("console-token");
            mono.Paths.ShouldContain("POST /api/merchant/invoice/create");
            (await api.WithDbAsync(db => db.Set<PlatformSetting>().SingleAsync(s => s.Key == "payments.gateways.v1", Ct))).Value.ShouldNotContain("console-token");
        }
        finally
        {
            await api.WithDbAsync(db => db.Set<PlatformSetting>().Where(s => s.Key == "payments.gateways.v1").ExecuteDeleteAsync(Ct));
        }
    }

    [Fact]
    public async Task LiqPay_webhook_without_saved_keys_is_rejected_not_a_server_error()
    {
        using var client = api.CreateClient();
        var data = LiqPayPaymentProvider.Encode(new JsonObject { ["order_id"] = "x", ["status"] = "success" });
        var response = await client.PostAsync("/api/v1/payments/webhooks/liqpay", Form(data, LiqPayPaymentProvider.Sign("any", data, LiqPaySignatures.Sha1)), Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    /// <summary>monobank acquiring: records which token each call carried.</summary>
    private sealed class FakeMono : HttpMessageHandler
    {
        public List<string> Tokens { get; } = [];

        public List<string> Paths { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            lock (Tokens)
            {
                Tokens.Add(request.Headers.GetValues("X-Token").Single());
                Paths.Add($"{request.Method} {request.RequestUri!.AbsolutePath}");
            }

            var body = request.RequestUri!.AbsolutePath switch
            {
                "/api/merchant/details" => """{"merchantId":"m1","merchantName":"Тестовий магазин"}""",
                "/api/merchant/invoice/create" => $$"""{"invoiceId":"inv-{{Guid.NewGuid():N}}","pageUrl":"https://pay.mbnk.biz/p2_test"}""",
                _ => """{"invoiceId":"inv","status":"created"}""",
            };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }

    private static SavePaymentGatewaysRequest Save(Guid? revision, bool liqPay, bool wallets) =>
        new(revision, false, null, false, liqPay, liqPay ? PublicKey : null, liqPay ? PrivateKey : null, false, wallets, "liqpay");

    private static FormUrlEncodedContent Form(string data, string signature) =>
        new(new Dictionary<string, string> { ["data"] = data, ["signature"] = signature });

    private async Task<OrderCreatedDto> CardOrderAsync(HttpClient client, decimal price)
    {
        var product = await api.AddProductAsync("ruchnyi-instrument", $"Товар для оплати LiqPay {price}", price, stock: 5);
        var body = CheckoutApiTests.Order(product.Id, 1, price.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), CheckoutApiTests.UniquePhone()) with
        {
            Delivery = new DeliveryRequest(DeliveryCodes.Pickup, null, null),
            Payment = new PaymentRequest(PaymentCodes.Card),
        };
        return await (await client.PostWithKeyAsync("/api/v1/orders", body)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
    }

    private static async Task<StartPaymentDto> StartAsync(HttpClient client, OrderCreatedDto order, string? method) =>
        await (await client.PostWithKeyAsync($"/api/v1/orders/{order.Number}/payments", new StartPaymentRequest(order.AccessToken, method)))
            .ReadAsync<StartPaymentDto>();

    /// <summary>LiqPay's request API: accepts only correctly signed requests and knows no orders.</summary>
    private sealed class FakeLiqPay : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var form = QueryHelpers.ParseQuery(await request.Content!.ReadAsStringAsync(cancellationToken));
            var data = form["data"].ToString();
            var body = LiqPayPaymentProvider.Verify(PrivateKey, data, form["signature"].ToString())
                ? """{"result":"error","err_code":"payment_not_found","err_description":"payment not found"}"""
                : """{"result":"error","err_code":"invalid_signature","err_description":"Invalid signature"}""";
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }
}
