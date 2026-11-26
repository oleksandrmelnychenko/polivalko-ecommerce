using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Features.Settings;
using PoliValko.Payments.Integrations.LiqPay;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.UnitTests.Payments;

public sealed class LiqPayProviderTests
{
    private const string PublicKey = "sandbox_i00000000";
    private const string PrivateKey = "sandbox_private";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public void Signature_matches_the_liqpay_documented_sha1_scheme()
    {
        // LiqPay docs: base64(sha1(private_key + data + private_key)).
        var data = "eyJ2ZXJzaW9uIjozfQ==";
        var expected = Convert.ToBase64String(System.Security.Cryptography.SHA1.HashData(Encoding.UTF8.GetBytes(PrivateKey + data + PrivateKey)));

        LiqPayPaymentProvider.Sign(PrivateKey, data, LiqPaySignatures.Sha1).ShouldBe(expected);
        LiqPayPaymentProvider.Verify(PrivateKey, data, expected).ShouldBeTrue();
        LiqPayPaymentProvider.Verify("other", data, expected).ShouldBeFalse();
    }

    [Fact]
    public async Task Checkout_link_carries_signed_order_with_our_payment_id()
    {
        var paymentId = Guid.CreateVersion7();
        var invoice = await Provider(new StubHandler()).CreateInvoiceAsync(
            new InvoiceRequest(paymentId, "PV-1001", 1234.5m, [], "https://shop.test/order/PV-1001", "https://shop.test/api/v1/payments/webhooks/liqpay",
                new DateTimeOffset(2026, 11, 26, 12, 0, 0, TimeSpan.Zero)),
            Ct);

        invoice.ProviderPaymentId.ShouldBe(paymentId.ToString("N"));
        var url = new Uri(invoice.PageUrl);
        url.GetLeftPart(UriPartial.Path).ShouldBe("https://www.liqpay.ua/api/3/checkout");
        var query = QueryHelpers.ParseQuery(url.Query);
        var data = query["data"].ToString();
        LiqPayPaymentProvider.Verify(PrivateKey, data, query["signature"].ToString()).ShouldBeTrue();
        var payload = JsonNode.Parse(Convert.FromBase64String(data))!.AsObject();
        payload["public_key"]!.GetValue<string>().ShouldBe(PublicKey);
        payload["order_id"]!.GetValue<string>().ShouldBe(paymentId.ToString("N"));
        payload["amount"]!.GetValue<decimal>().ShouldBe(1234.5m);
        payload["currency"]!.GetValue<string>().ShouldBe("UAH");
        payload["expired_date"]!.GetValue<string>().ShouldBe("2026-11-26 12:00:00");
        payload["server_url"]!.GetValue<string>().ShouldEndWith("/webhooks/liqpay");
    }

    [Theory]
    [InlineData("success", ProviderPaymentState.Succeeded)]
    [InlineData("sandbox", ProviderPaymentState.Succeeded)]
    [InlineData("failure", ProviderPaymentState.Failed)]
    [InlineData("error", ProviderPaymentState.Failed)]
    [InlineData("reversed", ProviderPaymentState.Reversed)]
    [InlineData("wait_accept", ProviderPaymentState.Processing)]
    [InlineData("3ds_verify", ProviderPaymentState.Processing)]
    public void Statuses_map_to_payment_states(string status, ProviderPaymentState expected) =>
        LiqPayPaymentProvider.ToStatus(new JsonObject { ["status"] = status, ["amount"] = 100 }, "p1").State.ShouldBe(expected);

    [Fact]
    public void Partial_reversal_reports_what_remains()
    {
        var status = LiqPayPaymentProvider.ToStatus(
            new JsonObject { ["status"] = "reversed", ["amount"] = 500, ["refund_amount"] = 200, ["end_date"] = 1715598023416 }, "p1");

        status.RemainingAmount.ShouldBe(300m);
        status.ModifiedAt.ShouldBe(DateTimeOffset.FromUnixTimeMilliseconds(1715598023416));
    }

    [Fact]
    public async Task Webhook_with_a_valid_signature_is_parsed_and_logged_as_json()
    {
        var data = LiqPayPaymentProvider.Encode(new JsonObject
        {
            ["public_key"] = PublicKey, ["order_id"] = "abc", ["status"] = "success", ["amount"] = 250.5, ["end_date"] = 1715598023416,
        });
        var body = Form(data, LiqPayPaymentProvider.Sign(PrivateKey, data, LiqPaySignatures.Sha1));

        var status = await Provider(new StubHandler()).ParseWebhookAsync(body, new HeaderDictionary(), Ct);

        status.ProviderPaymentId.ShouldBe("abc");
        status.State.ShouldBe(ProviderPaymentState.Succeeded);
        status.Amount.ShouldBe(250.5m);
        JsonNode.Parse(status.Payload!)!["order_id"]!.GetValue<string>().ShouldBe("abc");
    }

    [Fact]
    public async Task Webhook_with_a_forged_signature_or_another_shop_is_rejected()
    {
        var data = LiqPayPaymentProvider.Encode(new JsonObject { ["public_key"] = PublicKey, ["order_id"] = "abc", ["status"] = "success" });
        await Should.ThrowAsync<PaymentWebhookRejectedException>(() =>
            Provider(new StubHandler()).ParseWebhookAsync(Form(data, LiqPayPaymentProvider.Sign("wrong", data, LiqPaySignatures.Sha1)), new HeaderDictionary(), Ct));

        var foreign = LiqPayPaymentProvider.Encode(new JsonObject { ["public_key"] = "sandbox_other", ["order_id"] = "abc", ["status"] = "success" });
        await Should.ThrowAsync<PaymentWebhookRejectedException>(() =>
            Provider(new StubHandler()).ParseWebhookAsync(Form(foreign, LiqPayPaymentProvider.Sign(PrivateKey, foreign, LiqPaySignatures.Sha1)), new HeaderDictionary(), Ct));
    }

    [Fact]
    public async Task Unknown_order_means_the_page_was_not_paid_yet_and_can_be_withdrawn()
    {
        var handler = new StubHandler(
            (HttpStatusCode.OK, """{"result":"error","err_code":"payment_not_found","err_description":"payment not found"}"""),
            (HttpStatusCode.OK, """{"result":"error","err_code":"payment_not_found"}"""));
        var provider = Provider(handler);

        (await provider.GetStatusAsync("abc", Ct)).State.ShouldBe(ProviderPaymentState.Created);
        (await provider.CancelInvoiceAsync("abc", Ct)).ShouldBeTrue();
        handler.Requests.ShouldAllBe(r => r == "POST /api/request");
        var sent = QueryHelpers.ParseQuery(handler.Bodies[0]);
        LiqPayPaymentProvider.Verify(PrivateKey, sent["data"].ToString(), sent["signature"].ToString()).ShouldBeTrue();
        JsonNode.Parse(Convert.FromBase64String(sent["data"].ToString()))!["action"]!.GetValue<string>().ShouldBe("status");
    }

    [Fact]
    public async Task Paid_page_cannot_be_withdrawn()
    {
        var provider = Provider(new StubHandler((HttpStatusCode.OK, """{"result":"ok","status":"success","payment_id":1,"amount":10}""")));

        (await provider.CancelInvoiceAsync("abc", Ct)).ShouldBeFalse();
    }

    [Theory]
    [InlineData("""{"result":"ok","status":"reversed","payment_id":1}""", ProviderRefundState.Succeeded)]
    [InlineData("""{"result":"error","err_code":"err_amount","err_description":"amount"}""", ProviderRefundState.Failed)]
    [InlineData("""{"result":"ok","status":"processing"}""", ProviderRefundState.Processing)]
    public async Task Refund_reports_liqpay_outcome(string response, ProviderRefundState expected)
    {
        var handler = new StubHandler((HttpStatusCode.OK, response));

        (await Provider(handler).RefundAsync("abc", "ref", 100m, [], Ct)).State.ShouldBe(expected);
        var data = JsonNode.Parse(Convert.FromBase64String(QueryHelpers.ParseQuery(handler.Bodies[0])["data"].ToString()))!;
        data["action"]!.GetValue<string>().ShouldBe("refund");
        data["amount"]!.GetValue<decimal>().ShouldBe(100m);
    }

    [Fact]
    public async Task Refund_with_unknown_outcome_throws_so_it_is_not_sent_again()
    {
        var handler = new StubHandler((HttpStatusCode.BadGateway, "bad gateway"));

        await Should.ThrowAsync<HttpRequestException>(() => Provider(handler).RefundAsync("abc", "ref", 100m, [], Ct));
    }

    [Fact]
    public async Task Key_check_falls_back_to_sha3_when_sha1_is_refused()
    {
        if (!System.Security.Cryptography.SHA3_256.IsSupported)
        {
            return;
        }

        var handler = new StubHandler(
            (HttpStatusCode.OK, """{"result":"error","err_code":"invalid_signature","err_description":"Invalid signature"}"""),
            (HttpStatusCode.OK, """{"result":"error","err_code":"payment_not_found"}"""));

        (await Provider(handler).CheckAsync(Ct)).ShouldBe(LiqPaySignatures.Sha3);
    }

    private static byte[] Form(string data, string signature) =>
        Encoding.UTF8.GetBytes($"data={Uri.EscapeDataString(data)}&signature={Uri.EscapeDataString(signature)}");

    private static LiqPayPaymentProvider Provider(StubHandler handler) =>
        new(new HttpClient(handler), Options.Create(new PaymentsOptions()), new FixedPaymentCredentials(null, new LiqPayKeys(PublicKey, PrivateKey, LiqPaySignatures.Sha1)));

    private sealed class StubHandler(params (HttpStatusCode Status, string Body)[] responses) : HttpMessageHandler
    {
        private readonly Queue<(HttpStatusCode Status, string Body)> _responses = new(responses);

        public List<string> Requests { get; } = [];

        public List<string> Bodies { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add($"{request.Method} {request.RequestUri!.AbsolutePath}");
            Bodies.Add(request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken));
            var (status, body) = _responses.Dequeue();
            return new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        }
    }
}
