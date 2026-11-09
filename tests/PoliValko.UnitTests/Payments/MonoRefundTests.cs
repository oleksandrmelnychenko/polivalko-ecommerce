using System.Net;
using System.Text;
using Microsoft.Extensions.Options;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Integrations.Mono;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.UnitTests.Payments;

public sealed class MonoRefundTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static readonly IReadOnlyList<PaymentBasketItem> Basket = [new("Секатор", "T-1", 1, 500m)];

    [Theory]
    [InlineData("success", ProviderRefundState.Succeeded)]
    [InlineData("processing", ProviderRefundState.Processing)]
    [InlineData("failure", ProviderRefundState.Failed)]
    public async Task Refund_reports_monobank_status_without_treating_processing_as_done(string status, ProviderRefundState expected)
    {
        var handler = new StubHandler((HttpStatusCode.OK, $$"""{"status":"{{status}}","createdDate":"2026-11-08T10:00:00Z","modifiedDate":"2026-11-08T10:00:00Z"}"""));

        var result = await Provider(handler).RefundAsync("inv-1", "ref-1", 500m, Basket, Ct);

        result.State.ShouldBe(expected);
        handler.Requests.ShouldHaveSingleItem().ShouldBe("POST /api/merchant/invoice/cancel");
        handler.Bodies.Single().ShouldContain("\"extRef\":\"ref-1\"");
    }

    [Theory]
    [InlineData("reversed", 0L, 0)]
    [InlineData("reversed", 20000L, 200)]
    [InlineData("success", 30000L, null)]
    public void Reversal_reports_what_is_still_held_on_the_invoice(string status, long finalAmount, int? remaining)
    {
        var result = MonoPaymentProvider.ToStatus(new MonoPaymentProvider.InvoiceStatus("inv-1", status, null, 50000, finalAmount, DateTimeOffset.UtcNow));

        result.RemainingAmount.ShouldBe((decimal?)remaining);
    }

    [Fact]
    public void Reversal_without_a_final_amount_counts_as_a_full_return()
    {
        MonoPaymentProvider.ToStatus(new MonoPaymentProvider.InvoiceStatus("inv-1", "reversed", null, 50000, null, DateTimeOffset.UtcNow))
            .RemainingAmount.ShouldBeNull();
    }

    [Fact]
    public async Task Rejected_refund_fails_but_an_unknown_outcome_is_left_for_a_retry()
    {
        var rejected = await Provider(new StubHandler((HttpStatusCode.BadRequest, """{"errText":"amount exceeds"}""")))
            .RefundAsync("inv-1", "ref-1", 500m, Basket, Ct);
        rejected.State.ShouldBe(ProviderRefundState.Failed);
        rejected.Error.ShouldNotBeNull().ShouldContain("amount exceeds");

        await Should.ThrowAsync<HttpRequestException>(() => Provider(new StubHandler((HttpStatusCode.BadGateway, "")))
            .RefundAsync("inv-1", "ref-1", 500m, Basket, Ct));
    }

    [Fact]
    public async Task Earlier_refund_is_found_by_its_reference_in_the_cancel_list()
    {
        const string status = """
            {"invoiceId":"inv-1","status":"success","amount":100000,"finalAmount":50000,
             "cancelList":[{"status":"failure","amount":10000,"extRef":"other"},{"status":"success","amount":50000,"extRef":"ref-1"}]}
            """;
        var provider = Provider(new StubHandler((HttpStatusCode.OK, status), (HttpStatusCode.OK, status)));

        (await provider.FindRefundAsync("inv-1", "ref-1", Ct)).ShouldNotBeNull().State.ShouldBe(ProviderRefundState.Succeeded);
        (await provider.FindRefundAsync("inv-1", "never-sent", Ct)).ShouldBeNull();
    }

    [Fact]
    public async Task Paid_invoice_cannot_be_withdrawn()
    {
        var handler = new StubHandler((HttpStatusCode.OK, "{}"), (HttpStatusCode.BadRequest, """{"errText":"invoice already paid"}"""));
        var provider = Provider(handler);

        (await provider.CancelInvoiceAsync("inv-open", Ct)).ShouldBeTrue();
        (await provider.CancelInvoiceAsync("inv-paid", Ct)).ShouldBeFalse();
        handler.Requests.ShouldAllBe(r => r == "POST /api/merchant/invoice/remove");
        handler.Bodies[0].ShouldContain("\"invoiceId\":\"inv-open\"");
    }

    private static MonoPaymentProvider Provider(StubHandler handler) =>
        new(new HttpClient(handler), Options.Create(new PaymentsOptions { Mono = new MonoOptions { BaseUrl = "https://mono.test", Token = "test-token" } }));

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
