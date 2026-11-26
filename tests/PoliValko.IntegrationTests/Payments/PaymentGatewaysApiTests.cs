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
