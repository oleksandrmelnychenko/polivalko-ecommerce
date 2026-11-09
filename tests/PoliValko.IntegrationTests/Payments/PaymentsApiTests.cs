using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using PoliValko.Fiscal.Domain;
using PoliValko.Fiscal.Features.Receipts;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Console.Orders;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Payments.Features.Checkout;

namespace PoliValko.IntegrationTests;

public sealed class PaymentsApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private readonly HttpClient _client = api.CreateClient();

    [Fact]
    public async Task Failed_payment_can_be_reopened_and_success_is_applied_once()
    {
        var created = await CreateCardOrderAsync(6890m);

        var first = await StartAsync(created);
        first.PageUrl.ShouldContain("/pay/sandbox/");
        (await StartAsync(created)).PaymentId.ShouldBe(first.PaymentId, "активну спробу відкриваємо повторно, а не створюємо другу");

        await CompleteAsync(first, "failure");
        var afterFailure = await GetOrderAsync(created);
        afterFailure.PaymentStatus.ShouldBe(PaymentStatus.Failed);
        afterFailure.CanPay.ShouldBeTrue();

        var second = await StartAsync(created);
        second.PaymentId.ShouldNotBe(first.PaymentId);
        (await GetOrderAsync(created)).PaymentStatus.ShouldBe(PaymentStatus.Pending);

        var completion = await CompleteAsync(second, "success");
        completion.RedirectUrl.ShouldContain($"/order/{created.Number}");
        var paid = await GetOrderAsync(created);
        paid.Status.ShouldBe(OrderStatus.Paid);
        paid.PaymentStatus.ShouldBe(PaymentStatus.Succeeded);
        paid.CanPay.ShouldBeFalse();

        var again = await _client.PostWithKeyAsync($"/api/v1/orders/{created.Number}/payments", new StartPaymentRequest(created.AccessToken));
        again.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await again.ProblemCodeAsync()).ShouldBe("payments.not_payable");

        await api.ProcessOutboxAsync();
        api.Notifier.Sent.Count(n => n.Title == $"Оплачено замовлення {created.Number}").ShouldBe(1);
        var receipts = await _client.GetFromJsonAsync<List<ReceiptDto>>(
            $"/api/v1/orders/{created.Number}/receipts?token={Uri.EscapeDataString(created.AccessToken)}", TestJson.Options, Ct);
        var sell = receipts!.ShouldHaveSingleItem();
        sell.Kind.ShouldBe(ReceiptKind.Sell);
        sell.FiscalCode.ShouldStartWith("TEST-");
        sell.Amount.Value.ShouldBe("6890.00");
    }

    [Fact]
    public async Task Amount_mismatch_stays_payable_and_same_event_can_be_corrected_once()
    {
        var created = await CreateCardOrderAsync(1200m);
        var start = await StartAsync(created);
        var invoiceId = start.PageUrl[(start.PageUrl.LastIndexOf('/') + 1)..];
        var modifiedDate = DateTimeOffset.UtcNow;
        var wrong = JsonSerializer.SerializeToUtf8Bytes(new { invoiceId, status = "success", amount = "1.00", modifiedDate });
        (await PostWebhookAsync(wrong, Sign(wrong))).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await PostWebhookAsync(wrong, Sign(wrong))).StatusCode.ShouldBe(HttpStatusCode.OK);
        await api.ProcessOutboxAsync();
        api.Notifier.Sent.Count(n => n.Title == $"Розбіжність суми оплати {created.Number}").ShouldBe(1);
        (await GetOrderAsync(created)).PaymentStatus.ShouldBe(PaymentStatus.Pending);
        (await StartAsync(created)).PaymentId.ShouldBe(start.PaymentId);
        var corrected = JsonSerializer.SerializeToUtf8Bytes(new { invoiceId, status = "success", amount = "1200.00", modifiedDate });
        (await PostWebhookAsync(corrected, Sign(corrected))).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await PostWebhookAsync(corrected, Sign(corrected))).StatusCode.ShouldBe(HttpStatusCode.OK);
        var paid = await GetOrderAsync(created);
        paid.PaymentStatus.ShouldBe(PaymentStatus.Succeeded);
        paid.History.Count(h => h.Status == OrderStatus.Paid).ShouldBe(1);
    }

    [Fact]
    public async Task Webhook_requires_valid_signature_and_ignores_duplicates()
    {
        var created = await CreateCardOrderAsync(1200m);
        var start = await StartAsync(created);
        var invoiceId = start.PageUrl[(start.PageUrl.LastIndexOf('/') + 1)..];
        var body = JsonSerializer.SerializeToUtf8Bytes(new
        {
            invoiceId,
            status = "success",
            amount = "1200.00",
            modifiedDate = DateTimeOffset.UtcNow,
        });

        var forged = await PostWebhookAsync(body, "00" + Sign(body)[2..]);
        forged.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await forged.ProblemCodeAsync()).ShouldBe("payments.webhook_rejected");
        (await GetOrderAsync(created)).PaymentStatus.ShouldBe(PaymentStatus.Pending);

        (await PostWebhookAsync(body, Sign(body))).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await PostWebhookAsync(body, Sign(body))).StatusCode.ShouldBe(HttpStatusCode.OK);

        var order = await GetOrderAsync(created);
        order.Status.ShouldBe(OrderStatus.Paid);
        order.History.Count(h => h.Status == OrderStatus.Paid).ShouldBe(1);
    }

    [Fact]
    public async Task Partial_then_full_refund_returns_money_issues_return_receipts_and_allows_cancel()
    {
        var first = await api.AddProductAsync("ruchnyi-instrument", "Секатор для повернення", 500m, stock: 10);
        var second = await api.AddProductAsync("ruchnyi-instrument", "Рукавиці для повернення", 150m, stock: 10);
        var body = new CreateOrderRequest(
            [new CartLineRequest(first.Id, 2), new CartLineRequest(second.Id, 1)],
            "1150.00",
            new CustomerRequest("Повернення Тестове", CheckoutApiTests.UniquePhone(), null),
            new DeliveryRequest(DeliveryCodes.Pickup, null, null),
            new PaymentRequest(PaymentCodes.Card),
            null,
            AcceptOffer: true);
        var created = await (await _client.PostWithKeyAsync("/api/v1/orders", body)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        await CompleteAsync(await StartAsync(created), "success");
        await api.ProcessOutboxAsync();

        var admin = await Staff.AdminAsync(api);
        var cancelPaid = await admin.PostAsJsonAsync($"/api/v1/console/orders/{created.Number}/status", new { status = "cancelled" }, Ct);
        cancelPaid.StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var tooMany = await admin.PostWithKeyAsync($"/api/v1/console/orders/{created.Number}/refunds", new CreateRefundRequest([new RefundLineRequest(first.Id, 3)], "Забагато"));
        tooMany.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var partial = await (await admin.PostWithKeyAsync(
                $"/api/v1/console/orders/{created.Number}/refunds",
                new CreateRefundRequest([new RefundLineRequest(first.Id, 1)], "Покупець повернув один секатор")))
            .ReadAsync<ConsoleOrderDto>();
        partial.RefundMethod.ShouldBe(RefundMethod.Provider);
        partial.Refunds.ShouldHaveSingleItem().Status.ShouldBe(RefundStatus.Pending);

        await api.ProcessOutboxAsync();
        await api.ProcessOutboxAsync();
        var afterPartial = await admin.GetFromJsonAsync<ConsoleOrderDto>($"/api/v1/console/orders/{created.Number}", TestJson.Options, Ct);
        afterPartial!.PaymentStatus.ShouldBe(PaymentStatus.PartiallyRefunded);
        afterPartial.RefundedAmount.Value.ShouldBe("500.00");
        afterPartial.Refundable.ShouldBe([new RefundableItemDto(first.Id, 1), new RefundableItemDto(second.Id, 1)], ignoreOrder: true);

        await (await admin.PostWithKeyAsync(
                $"/api/v1/console/orders/{created.Number}/refunds",
                new CreateRefundRequest([new RefundLineRequest(first.Id, 1), new RefundLineRequest(second.Id, 1)], "Скасування")))
            .ReadAsync<ConsoleOrderDto>();
        await api.ProcessOutboxAsync();
        await api.ProcessOutboxAsync();

        var refunded = await admin.GetFromJsonAsync<ConsoleOrderDto>($"/api/v1/console/orders/{created.Number}", TestJson.Options, Ct);
        refunded!.PaymentStatus.ShouldBe(PaymentStatus.Refunded);
        refunded.RefundedAmount.Value.ShouldBe("1150.00");
        refunded.AllowedTransitions.ShouldContain(OrderStatus.Cancelled);

        var receipts = await admin.GetFromJsonAsync<List<ReceiptDto>>($"/api/v1/console/orders/{created.Number}/receipts", TestJson.Options, Ct);
        receipts!.Select(r => (r.Kind, r.Amount.Value)).ShouldBe(
            [(ReceiptKind.Sell, "1150.00"), (ReceiptKind.Return, "500.00"), (ReceiptKind.Return, "650.00")]);
        receipts!.ShouldAllBe(r => r.Status == ReceiptStatus.Issued);

        (await admin.PostAsJsonAsync($"/api/v1/console/orders/{created.Number}/status", new { status = "cancelled", reason = "Кошти повернуто" }, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Cash_on_delivery_gets_receipt_on_completion_and_manual_refund()
    {
        var product = await api.AddProductAsync("hospodarchi-tovary", "Відро для післяплати", 320m, stock: 5);
        var created = await (await _client.PostWithKeyAsync("/api/v1/orders", CheckoutApiTests.Order(product.Id, 1, "320.00", CheckoutApiTests.UniquePhone())))
            .ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var admin = await Staff.AdminAsync(api);

        var notYet = await admin.PostWithKeyAsync($"/api/v1/console/orders/{created.Number}/refunds", new CreateRefundRequest([new RefundLineRequest(product.Id, 1)], "Рано"));
        notYet.StatusCode.ShouldBe(HttpStatusCode.Conflict);

        foreach (var status in new[] { "confirmed", "shipped", "completed" })
        {
            (await admin.PostAsJsonAsync($"/api/v1/console/orders/{created.Number}/status", new { status }, Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
        }

        var refund = await (await admin.PostWithKeyAsync(
                $"/api/v1/console/orders/{created.Number}/refunds",
                new CreateRefundRequest([new RefundLineRequest(product.Id, 1)], "Повернення в магазині")))
            .ReadAsync<ConsoleOrderDto>();
        refund.Refunds.ShouldHaveSingleItem().Method.ShouldBe(RefundMethod.Manual);
        refund.Refunds[0].Status.ShouldBe(RefundStatus.Succeeded);
        refund.PaymentStatus.ShouldBe(PaymentStatus.NotRequired);

        await api.ProcessOutboxAsync();
        var receipts = await admin.GetFromJsonAsync<List<ReceiptDto>>($"/api/v1/console/orders/{created.Number}/receipts", TestJson.Options, Ct);
        receipts!.Select(r => r.Kind).ShouldBe([ReceiptKind.Sell, ReceiptKind.Return]);
    }

    [Fact]
    public async Task Courier_delivery_requires_address()
    {
        var product = await api.AddProductAsync("hospodarchi-tovary", "Тачка для кур'єра", 2450m, stock: 3);
        var body = CheckoutApiTests.Order(product.Id, 1, "2450.00", CheckoutApiTests.UniquePhone()) with
        {
            Delivery = new DeliveryRequest(DeliveryCodes.NovaPoshtaCourier, "demo-irpin", null, new DeliveryAddressRequest("", null, null)),
        };

        var invalid = await _client.PostWithKeyAsync("/api/v1/orders", body);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys
            .ShouldBe(["delivery.address.street", "delivery.address.house"], ignoreOrder: true);

        var created = await (await _client.PostWithKeyAsync("/api/v1/orders", body with
            {
                Delivery = new DeliveryRequest(DeliveryCodes.NovaPoshtaCourier, "demo-irpin", null, new DeliveryAddressRequest("вул. Соборна", "12", "5")),
            }))
            .ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var order = await GetOrderAsync(created);
        order.DeliveryMethod.ShouldBe(DeliveryCodes.NovaPoshtaCourier);
        order.Delivery.Address.ShouldBe("вул. Соборна, буд. 12, кв. 5");
        order.Delivery.SettlementName.ShouldBe("Ірпінь");
    }

    private async Task<OrderCreatedDto> CreateCardOrderAsync(decimal price)
    {
        var product = await api.AddProductAsync("tekhnika-dlia-sadu-ta-horodu", $"Товар для оплати {price}", price, stock: 3);
        var body = CheckoutApiTests.Order(product.Id, 1, price.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture), CheckoutApiTests.UniquePhone()) with
        {
            Delivery = new DeliveryRequest(DeliveryCodes.Pickup, null, null),
            Payment = new PaymentRequest(PaymentCodes.Card),
        };
        var created = await (await _client.PostWithKeyAsync("/api/v1/orders", body)).ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        created.Status.ShouldBe(OrderStatus.AwaitingPayment);
        created.PaymentRequired.ShouldBeTrue();
        return created;
    }

    private async Task<StartPaymentDto> StartAsync(OrderCreatedDto order) =>
        await (await _client.PostWithKeyAsync($"/api/v1/orders/{order.Number}/payments", new StartPaymentRequest(order.AccessToken)))
            .ReadAsync<StartPaymentDto>();

    private async Task<SandboxCompletionDto> CompleteAsync(StartPaymentDto payment, string outcome)
    {
        var invoiceId = payment.PageUrl[(payment.PageUrl.LastIndexOf('/') + 1)..];
        return await (await _client.PostAsJsonAsync($"/api/v1/payments/sandbox/{invoiceId}/complete", new CompleteSandboxPaymentRequest(outcome, null), Ct))
            .ReadAsync<SandboxCompletionDto>();
    }

    private async Task<OrderDto> GetOrderAsync(OrderCreatedDto order) =>
        (await _client.GetFromJsonAsync<OrderDto>($"/api/v1/orders/{order.Number}?token={Uri.EscapeDataString(order.AccessToken)}", TestJson.Options, Ct))!;

    private Task<HttpResponseMessage> PostWebhookAsync(byte[] body, string signature)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/payments/webhooks/sandbox") { Content = new ByteArrayContent(body) };
        request.Headers.Add("X-Sandbox-Signature", signature);
        return _client.SendAsync(request, Ct);
    }

    private static string Sign(byte[] body) =>
        Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(ApiFactory.SandboxSecret), body));
}
