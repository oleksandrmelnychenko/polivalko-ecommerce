using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Integrations.Mono;

internal sealed class MonoPaymentProvider(HttpClient http, IOptions<PaymentsOptions> options) : IPaymentProvider
{
    private const int Hryvnia = 980;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private static string? cachedKey;

    internal sealed record BasketItem(string Name, int Qty, long Sum, string Code, long Total);

    internal sealed record MerchantPaymInfo(string Reference, string Destination, IReadOnlyList<BasketItem> BasketOrder);

    internal sealed record CreateInvoiceBody(long Amount, int Ccy, MerchantPaymInfo MerchantPaymInfo, string RedirectUrl, string WebHookUrl, int Validity, string PaymentType);

    internal sealed record CreateInvoiceResponse(string InvoiceId, string PageUrl);

    internal sealed record InvoiceStatus(string InvoiceId, string Status, string? FailureReason, long? Amount, long? FinalAmount, DateTimeOffset? ModifiedDate);

    internal sealed record CancelBody(string InvoiceId, string ExtRef, long Amount, IReadOnlyList<BasketItem> Items);

    internal sealed record CancelResponse(string Status, DateTimeOffset? ModifiedDate);

    internal sealed record PubKeyResponse(string Key);

    public string Name => PaymentProviderNames.Mono;

    public async Task<CreatedInvoice> CreateInvoiceAsync(InvoiceRequest request, CancellationToken ct)
    {
        var body = new CreateInvoiceBody(
            Kopecks(request.Amount),
            Hryvnia,
            new MerchantPaymInfo(
                $"{request.OrderNumber}/{request.PaymentId:N}",
                $"Оплата замовлення {request.OrderNumber}",
                Basket(request.Basket)),
            request.RedirectUrl,
            request.WebhookUrl,
            (int)Math.Max(60, (request.ExpiresAt - DateTimeOffset.UtcNow).TotalSeconds),
            "debit");

        using var response = await SendAsync(HttpMethod.Post, "/api/merchant/invoice/create", body, ct);
        var created = await response.Content.ReadFromJsonAsync<CreateInvoiceResponse>(Json, ct)
            ?? throw new InvalidOperationException("Порожня відповідь monobank на створення рахунку.");
        return new CreatedInvoice(created.InvoiceId, created.PageUrl);
    }

    public async Task<ProviderPaymentStatus> GetStatusAsync(string providerPaymentId, CancellationToken ct)
    {
        using var response = await SendAsync(HttpMethod.Get, $"/api/merchant/invoice/status?invoiceId={Uri.EscapeDataString(providerPaymentId)}", null, ct);
        var status = await response.Content.ReadFromJsonAsync<InvoiceStatus>(Json, ct)
            ?? throw new InvalidOperationException("Порожня відповідь monobank на запит статусу.");
        return ToStatus(status);
    }

    public async Task<ProviderPaymentStatus> ParseWebhookAsync(byte[] body, IHeaderDictionary headers, CancellationToken ct)
    {
        var signature = headers["X-Sign"].ToString();
        if (signature.Length == 0)
        {
            throw new PaymentWebhookRejectedException("Немає заголовка X-Sign.");
        }

        if (!Verify(body, signature, cachedKey ??= await FetchKeyAsync(ct)))
        {
            cachedKey = await FetchKeyAsync(ct);
            if (!Verify(body, signature, cachedKey))
            {
                throw new PaymentWebhookRejectedException("Підпис X-Sign не збігається.");
            }
        }

        var status = JsonSerializer.Deserialize<InvoiceStatus>(body, Json)
            ?? throw new PaymentWebhookRejectedException("Порожнє повідомлення.");
        return ToStatus(status);
    }

    public async Task<ProviderRefundResult> RefundAsync(string providerPaymentId, Guid refundId, decimal amount, IReadOnlyList<PaymentBasketItem> items, CancellationToken ct)
    {
        var body = new CancelBody(providerPaymentId, refundId.ToString("N"), Kopecks(amount), Basket(items));
        using var response = await SendAsync(HttpMethod.Post, "/api/merchant/invoice/cancel", body, ct, throwOnError: false);
        if (!response.IsSuccessStatusCode)
        {
            return new ProviderRefundResult(false, null, $"monobank відхилив повернення: {(int)response.StatusCode} {await response.Content.ReadAsStringAsync(ct)}");
        }

        var result = await response.Content.ReadFromJsonAsync<CancelResponse>(Json, ct);
        return result?.Status == "failure"
            ? new ProviderRefundResult(false, null, "monobank повідомив про невдале повернення.")
            : new ProviderRefundResult(true, refundId.ToString("N"), null);
    }

    internal static bool Verify(byte[] body, string signatureBase64, string publicKeyBase64)
    {
        try
        {
            using var ecdsa = ECDsa.Create();
            ecdsa.ImportFromPem(Encoding.ASCII.GetString(Convert.FromBase64String(publicKeyBase64)));
            return ecdsa.VerifyData(body, Convert.FromBase64String(signatureBase64), HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence);
        }
        catch (FormatException)
        {
            return false;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }

    internal static ProviderPaymentStatus ToStatus(InvoiceStatus status) => new(
        status.InvoiceId,
        status.Status switch
        {
            "success" => ProviderPaymentState.Succeeded,
            "failure" => ProviderPaymentState.Failed,
            "expired" => ProviderPaymentState.Expired,
            "reversed" => ProviderPaymentState.Reversed,
            "processing" or "hold" => ProviderPaymentState.Processing,
            _ => ProviderPaymentState.Created,
        },
        (status.FinalAmount ?? status.Amount) is { } kop ? kop / 100m : null,
        status.ModifiedDate,
        status.FailureReason);

    private async Task<string> FetchKeyAsync(CancellationToken ct)
    {
        using var response = await SendAsync(HttpMethod.Get, "/api/merchant/pubkey", null, ct);
        var key = await response.Content.ReadFromJsonAsync<PubKeyResponse>(Json, ct);
        return key?.Key ?? throw new InvalidOperationException("monobank не повернув публічний ключ.");
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, object? body, CancellationToken ct, bool throwOnError = true)
    {
        var settings = options.Value.Mono;
        if (string.IsNullOrWhiteSpace(settings.Token))
        {
            throw new InvalidOperationException("Не задано Payments:Mono:Token.");
        }

        using var request = new HttpRequestMessage(method, $"{settings.BaseUrl.TrimEnd('/')}{path}");
        request.Headers.Add("X-Token", settings.Token);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body, body.GetType(), options: Json);
        }

        var response = await http.SendAsync(request, ct);
        if (throwOnError && !response.IsSuccessStatusCode)
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            response.Dispose();
            throw new HttpRequestException($"monobank {path}: {(int)response.StatusCode} {text}");
        }

        return response;
    }

    private static long Kopecks(decimal amount) => (long)decimal.Round(amount * 100, 0, MidpointRounding.AwayFromZero);

    private static List<BasketItem> Basket(IReadOnlyList<PaymentBasketItem> items) =>
        items.Select(i => new BasketItem(i.Name, i.Quantity, Kopecks(i.UnitPrice), i.Code, Kopecks(i.UnitPrice * i.Quantity))).ToList();
}
