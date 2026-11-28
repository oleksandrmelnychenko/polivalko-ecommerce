using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Fiscal.Domain;
using PoliValko.Fiscal.Features.Receipts;
using PoliValko.Fiscal.Features.Settings;
using PoliValko.Fiscal.Integrations.Checkbox;
using PoliValko.Infrastructure.Settings;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Features.Console.Orders;
using PoliValko.Payments.Features.Checkout;

namespace PoliValko.IntegrationTests;

/// <summary>The Checkbox cash register and receipt moments are set in the console; secrets never come back.</summary>
// Shares the stored receipt settings with PaymentSettingsApiTests, so the two never run at the same time.
[Collection("Payment settings")]
public sealed class FiscalSettingsApiTests(ApiFactory api)
{
    private const string Path = "/api/v1/console/settings/fiscal";
    private const string License = "test-license-never-returned";
    private const string Password = "cashier-password-never-returned";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Keys_need_the_payments_permission()
    {
        using var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync(Path, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.PostAsJsonAsync(Path + "/check", new CheckFiscalRequest(License, "cashier", Password), Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Checkbox_is_checked_saved_encrypted_and_switched_off_without_losing_receipt_moments()
    {
        var checkbox = new FakeCheckbox();
        await using var host = api.WithWebHostBuilder(builder => builder.ConfigureServices(services =>
        {
            services.AddHttpClient(FiscalSettingsEndpoints.CheckClient).ConfigurePrimaryHttpMessageHandler(() => checkbox);
            services.AddHttpClient<CheckboxFiscalProvider>().ConfigurePrimaryHttpMessageHandler(() => checkbox);
        }));
        using var admin = host.CreateClient();
        (await admin.PostAsJsonAsync("/api/v1/console/auth/login", new { email = ApiFactory.AdminEmail, password = ApiFactory.TestPassword }, Ct)).EnsureSuccessStatusCode();
        var csrf = await admin.GetFromJsonAsync<PoliValko.Infrastructure.Security.CsrfTokenDto>("/api/v1/console/auth/csrf", Ct);
        admin.DefaultRequestHeaders.Add(PoliValko.Infrastructure.Security.CsrfHeaders.Token, csrf!.Token);
        try
        {
            var original = await admin.ReadAsync<FiscalGatewayDto>(Path);
            original.Source.ShouldBe("environment");
            original.Provider.ShouldBe("Stub");
            original.StubAvailable.ShouldBeTrue();
            original.IssueOn.ShouldBe(new ReceiptMomentsDto("payment", "completion", "none"));

            (await admin.PutAsJsonAsync(Path, new SaveFiscalSettingsRequest(original.Revision, false, null, null, null, false,
                new ReceiptMomentsDto("payment", "payment", "none")), Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

            var wrong = await admin.PostAsJsonAsync(Path + "/check", new CheckFiscalRequest(License, "cashier", "wrong"), Ct);
            wrong.StatusCode.ShouldBe(HttpStatusCode.BadGateway);
            (await (await admin.PostAsJsonAsync(Path + "/check", new CheckFiscalRequest(License, "cashier", Password), Ct))
                .ReadAsync<CheckFiscalDto>()).FiscalNumber.ShouldBe("4000123456");

            var response = await admin.PutAsJsonAsync(Path, new SaveFiscalSettingsRequest(original.Revision, true, License, "cashier", Password, false,
                new ReceiptMomentsDto("payment", "completion", "none")), Ct);
            var text = await response.Content.ReadAsStringAsync(Ct);
            text.ShouldNotContain(License);
            text.ShouldNotContain(Password);
            var saved = await response.ReadAsync<FiscalGatewayDto>();
            saved.Provider.ShouldBe("Checkbox");
            saved.Source.ShouldBe("console");
            saved.HasLicenseKey.ShouldBeTrue();
            saved.HasPassword.ShouldBeTrue();
            saved.CashierLogin.ShouldBe("cashier");
            saved.FiscalNumber.ShouldBe("4000123456");
            var stored = (await api.WithDbAsync(db => db.Set<PlatformSetting>().SingleAsync(s => s.Key == "fiscal.checkbox.v1", Ct))).Value;
            stored.ShouldNotContain(License);
            stored.ShouldNotContain(Password);

            var settings = await admin.ReadAsync<PoliValko.Console.Features.Settings.PaymentSettingsDto>("/api/v1/console/settings/payments");
            (settings.FiscalProvider, settings.FiscalMode).ShouldBe(("Checkbox", "Live"));

            // Off again, keys kept for later; on a test server the stub takes over, and the moments are the manager's.
            var off = await (await admin.PutAsJsonAsync(Path, new SaveFiscalSettingsRequest(saved.Revision, false, null, null, null, false,
                new ReceiptMomentsDto("completion", "completion", "none")), Ct)).ReadAsync<FiscalGatewayDto>();
            off.Provider.ShouldBe("Stub");
            off.HasPassword.ShouldBeTrue();
            off.IssueOn.Card.ShouldBe("completion");
            (await admin.PutAsJsonAsync(Path, new SaveFiscalSettingsRequest(saved.Revision, false, null, null, null, false,
                new ReceiptMomentsDto("payment", "completion", "none")), Ct)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        }
        finally
        {
            await api.WithDbAsync(db => db.Set<PlatformSetting>().Where(s => s.Key == "fiscal.checkbox.v1").ExecuteDeleteAsync(Ct));
        }
    }

    [Fact]
    public async Task Card_order_with_completion_moment_issues_sale_on_completion_and_skips_return_before_completion()
    {
        using var admin = await Staff.AdminAsync(api);
        using var client = api.CreateClient();
        var original = await admin.ReadAsync<FiscalGatewayDto>(Path);
        try
        {
            (await admin.PutAsJsonAsync(Path, new SaveFiscalSettingsRequest(original.Revision, false, null, null, null, false,
                new ReceiptMomentsDto("completion", "completion", "none")), Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);

            async Task<(OrderCreatedDto Order, Guid ProductId)> CreatePaidCardOrderAsync(decimal price)
            {
                var product = await api.AddProductAsync("ruchnyi-instrument", $"Чек при виконанні {price}", price, stock: 5);
                var body = CheckoutApiTests.Order(product.Id, 1, price.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), CheckoutApiTests.UniquePhone()) with
                {
                    Delivery = new DeliveryRequest(DeliveryCodes.Pickup, null, null),
                    Payment = new PaymentRequest(PaymentCodes.Card),
                };
                var created = await (await client.PostWithKeyAsync("/api/v1/orders", body)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
                var start = await (await client.PostWithKeyAsync($"/api/v1/orders/{created.Number}/payments", new StartPaymentRequest(created.AccessToken)))
                    .ReadAsync<StartPaymentDto>();
                var invoiceId = start.PageUrl[(start.PageUrl.LastIndexOf('/') + 1)..];
                (await client.PostAsJsonAsync($"/api/v1/payments/sandbox/{invoiceId}/complete", new CompleteSandboxPaymentRequest("success", null), Ct))
                    .StatusCode.ShouldBe(HttpStatusCode.OK);
                await api.ProcessOutboxAsync();
                return (created, product.Id);
            }

            // Refunded before completion: neither sale nor return receipt should be issued.
            var (earlyOrder, earlyProductId) = await CreatePaidCardOrderAsync(210m);
            (await admin.GetFromJsonAsync<List<ReceiptDto>>($"/api/v1/console/orders/{earlyOrder.Number}/receipts", TestJson.Options, Ct))!.ShouldBeEmpty();
            await (await admin.PostWithKeyAsync(
                    $"/api/v1/console/orders/{earlyOrder.Number}/refunds",
                    new CreateRefundRequest([new RefundLineRequest(earlyProductId, 1)], "Скасування до видачі")))
                .ReadAsync<ConsoleOrderDto>();
            await api.ProcessOutboxAsync();
            await api.ProcessOutboxAsync();
            (await admin.GetFromJsonAsync<List<ReceiptDto>>($"/api/v1/console/orders/{earlyOrder.Number}/receipts", TestJson.Options, Ct))!.ShouldBeEmpty();

            // Completed then refunded: sale receipt issued on completion, return receipt issued on refund.
            var (completedOrder, completedProductId) = await CreatePaidCardOrderAsync(320m);
            (await admin.GetFromJsonAsync<List<ReceiptDto>>($"/api/v1/console/orders/{completedOrder.Number}/receipts", TestJson.Options, Ct))!.ShouldBeEmpty();
            foreach (var status in new[] { OrderStatus.ReadyForPickup, OrderStatus.Completed })
            {
                (await admin.PostJsonAsync($"/api/v1/console/orders/{completedOrder.Number}/status", new ChangeOrderStatusRequest(status, "Видача")))
                    .StatusCode.ShouldBe(HttpStatusCode.OK);
            }
            await api.ProcessOutboxAsync();
            var afterCompletion = await admin.GetFromJsonAsync<List<ReceiptDto>>($"/api/v1/console/orders/{completedOrder.Number}/receipts", TestJson.Options, Ct);
            afterCompletion!.ShouldHaveSingleItem().Kind.ShouldBe(ReceiptKind.Sell);

            await (await admin.PostWithKeyAsync(
                    $"/api/v1/console/orders/{completedOrder.Number}/refunds",
                    new CreateRefundRequest([new RefundLineRequest(completedProductId, 1)], "Повернення після видачі")))
                .ReadAsync<ConsoleOrderDto>();
            await api.ProcessOutboxAsync();
            await api.ProcessOutboxAsync();
            var afterRefund = await admin.GetFromJsonAsync<List<ReceiptDto>>($"/api/v1/console/orders/{completedOrder.Number}/receipts", TestJson.Options, Ct);
            afterRefund!.Select(r => r.Kind).ShouldBe([ReceiptKind.Sell, ReceiptKind.Return]);
        }
        finally
        {
            await api.WithDbAsync(db => db.Set<PlatformSetting>().Where(s => s.Key == "fiscal.checkbox.v1").ExecuteDeleteAsync(Ct));
        }
    }

    /// <summary>Checkbox: the cashier signs in with the right password, and the license key opens one cash register.</summary>
    private sealed class FakeCheckbox : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var licensed = request.Headers.TryGetValues("X-License-Key", out var keys) && keys.Single() == License;
            var (status, body) = request.RequestUri!.AbsolutePath switch
            {
                "/api/v1/cashier/signin" when (await request.Content!.ReadAsStringAsync(cancellationToken)).Contains(Password, StringComparison.Ordinal)
                    => (HttpStatusCode.OK, """{"access_token":"cashier-token"}"""),
                "/api/v1/cashier/signin" => (HttpStatusCode.Unauthorized, """{"message":"Невірний логін або пароль"}"""),
                "/api/v1/cash-registers/info" when licensed => (HttpStatusCode.OK, """{"fiscal_number":"4000123456","address":"Буча"}"""),
                _ => (HttpStatusCode.Forbidden, """{"message":"Invalid license key"}"""),
            };
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }
}
