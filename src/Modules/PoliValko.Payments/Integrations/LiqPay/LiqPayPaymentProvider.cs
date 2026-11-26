using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using PoliValko.Payments.Configuration;
using PoliValko.Payments.Features.Settings;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Integrations.LiqPay;

/// <summary>
/// LiqPay, PrivatBank's internet acquiring (API v3). The buyer pays on LiqPay's checkout page, which also offers
/// Privat24, Apple Pay and Google Pay when they are on in the LiqPay cabinet. Our payment id is LiqPay's
/// <c>order_id</c>, so the invoice id is known before the buyer opens the page.
/// </summary>
internal sealed class LiqPayPaymentProvider(HttpClient http, IOptions<PaymentsOptions> options, IPaymentCredentials credentials) : IPaymentProvider
{
    private const int ApiVersion = 3;

    public string Name => PaymentProviderNames.LiqPay;

    // LiqPay refunds carry no merchant reference, so a refund with an unknown outcome cannot be looked up.
    public bool CanFindRefunds => false;

    public async Task<CreatedInvoice> CreateInvoiceAsync(InvoiceRequest request, CancellationToken ct)
    {
        var keys = await KeysAsync(ct);
        var orderId = request.PaymentId.ToString("N");
        var data = Encode(new JsonObject
        {
            ["version"] = ApiVersion,
            ["public_key"] = keys.PublicKey,
            ["action"] = "pay",
            ["amount"] = decimal.Round(request.Amount, 2),
            ["currency"] = "UAH",
            ["description"] = $"Оплата замовлення {request.OrderNumber}",
            ["order_id"] = orderId,
            ["result_url"] = request.RedirectUrl,
            ["server_url"] = request.WebhookUrl,
            ["expired_date"] = request.ExpiresAt.UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
            ["language"] = "uk",
        });
        var signature = Sign(keys.PrivateKey, data, keys.Signature);
        var url = QueryHelpers.AddQueryString($"{BaseUrl}/api/3/checkout", new Dictionary<string, string?> { ["data"] = data, ["signature"] = signature });
        return new CreatedInvoice(orderId, url);
    }

    public async Task<ProviderPaymentStatus> GetStatusAsync(string providerPaymentId, CancellationToken ct)
    {
        var response = await RequestAsync(new JsonObject { ["action"] = "status", ["order_id"] = providerPaymentId }, ct);
        if (IsNotFound(response))
        {
            // The buyer has not paid or even opened the page yet.
            return new ProviderPaymentStatus(providerPaymentId, ProviderPaymentState.Created, null, null, null);
        }

        if (response["payment_id"] is null && (Text(response, "result") == "error" || Text(response, "err_code") is not null || Text(response, "status") == "error"))
        {
            throw new InvalidOperationException($"LiqPay status: {Text(response, "err_code")} {Text(response, "err_description")}".Trim());
        }

        return ToStatus(response, providerPaymentId);
    }

    public async Task<ProviderPaymentStatus> ParseWebhookAsync(byte[] body, IHeaderDictionary headers, CancellationToken ct)
    {
        var form = QueryHelpers.ParseQuery(Encoding.UTF8.GetString(body));
        var data = form.TryGetValue("data", out var d) ? d.ToString() : "";
        var signature = form.TryGetValue("signature", out var s) ? s.ToString() : "";
        if (data.Length == 0 || signature.Length == 0)
        {
            throw new PaymentWebhookRejectedException("Немає data або signature.");
        }

        var keys = await credentials.LiqPayAsync(ct) ?? throw new PaymentWebhookRejectedException("Ключі LiqPay не задано.");
        if (!Verify(keys.PrivateKey, data, signature))
        {
            throw new PaymentWebhookRejectedException("Підпис LiqPay не збігається.");
        }

        JsonObject payload;
        try
        {
            payload = JsonNode.Parse(Convert.FromBase64String(data)) as JsonObject
                ?? throw new PaymentWebhookRejectedException("Порожнє повідомлення.");
        }
        catch (FormatException)
        {
            throw new PaymentWebhookRejectedException("data не в Base64.");
        }

        if (Text(payload, "public_key") is { } publicKey && publicKey != keys.PublicKey)
        {
            throw new PaymentWebhookRejectedException("Повідомлення для іншого магазину LiqPay.");
        }

        var orderId = Text(payload, "order_id") ?? throw new PaymentWebhookRejectedException("Немає order_id.");
        return ToStatus(payload, orderId) with { Payload = payload.ToJsonString() };
    }

    public async Task<ProviderRefundResult> RefundAsync(string providerPaymentId, string reference, decimal amount, IReadOnlyList<PaymentBasketItem> items, CancellationToken ct)
    {
        JsonObject response;
        try
        {
            response = await RequestAsync(new JsonObject { ["action"] = "refund", ["order_id"] = providerPaymentId, ["amount"] = decimal.Round(amount, 2) }, ct);
        }
        catch (LiqPayRejectedException ex)
        {
            return ProviderRefundResult.Failed($"LiqPay відхилив повернення: {ex.Message}");
        }

        return ToRefund(response);
    }

    public Task<ProviderRefundResult?> FindRefundAsync(string providerPaymentId, string reference, CancellationToken ct) =>
        throw new NotSupportedException("LiqPay не дає знайти повернення за референсом.");

    public async Task<bool> CancelInvoiceAsync(string providerPaymentId, CancellationToken ct)
    {
        // A LiqPay checkout link cannot be withdrawn; it stops taking money at expired_date. Report it withdrawn
        // only while nothing is paid or in progress: a payment made afterwards still arrives and raises the usual alert.
        var status = await GetStatusAsync(providerPaymentId, ct);
        return status.State is ProviderPaymentState.Created or ProviderPaymentState.Failed or ProviderPaymentState.Expired;
    }

    /// <summary>
    /// Checks the keys with a status request for an order that does not exist: LiqPay answers "not found" only to a
    /// correctly signed request. Returns the signature scheme that worked; LiqPay's docs name both SHA-1 and SHA3-256.
    /// </summary>
    public async Task<string> CheckAsync(CancellationToken ct)
    {
        var keys = await KeysAsync(ct);
        string? last = null;
        foreach (var scheme in new[] { keys.Signature, LiqPaySignatures.Sha1, LiqPaySignatures.Sha3 }.Distinct())
        {
            if (scheme == LiqPaySignatures.Sha3 && !SHA3_256.IsSupported)
            {
                continue;
            }

            try
            {
                var response = await RequestAsync(
                    new JsonObject { ["action"] = "status", ["order_id"] = $"check-{Guid.NewGuid():N}" },
                    ct,
                    keys with { Signature = scheme });
                if (IsNotFound(response) || Text(response, "result") == "ok")
                {
                    return scheme;
                }

                last = $"{Text(response, "err_code")} {Text(response, "err_description")}".Trim();
            }
            catch (LiqPayRejectedException ex)
            {
                last = ex.Message;
            }
        }

        throw new LiqPayRejectedException(last ?? "LiqPay не прийняв ключі.");
    }

    internal static ProviderPaymentStatus ToStatus(JsonObject payload, string orderId)
    {
        var status = Text(payload, "status") ?? "";
        var amount = Number(payload, "amount");
        var refunded = Number(payload, "refund_amount");
        var state = status switch
        {
            "success" or "sandbox" => ProviderPaymentState.Succeeded,
            "failure" or "error" => ProviderPaymentState.Failed,
            "reversed" => ProviderPaymentState.Reversed,
            _ => ProviderPaymentState.Processing,
        };
        return new ProviderPaymentStatus(
            orderId,
            state,
            amount,
            Date(payload, "end_date") ?? Date(payload, "create_date"),
            state == ProviderPaymentState.Failed ? Text(payload, "err_description") ?? Text(payload, "err_code") : null)
        {
            RemainingAmount = state == ProviderPaymentState.Reversed && amount is { } a && refunded is { } r ? Math.Max(a - r, 0m) : null,
        };
    }

    internal static ProviderRefundResult ToRefund(JsonObject response) =>
        (Text(response, "result"), Text(response, "status")) switch
        {
            ("ok", "reversed" or "success") => ProviderRefundResult.Succeeded,
            (_, "error" or "failure") or ("error", _) => ProviderRefundResult.Failed(
                $"LiqPay повідомив про невдале повернення: {Text(response, "err_description") ?? Text(response, "err_code")}"),
            _ => ProviderRefundResult.Processing,
        };

    internal static string Encode(JsonObject payload) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(payload.ToJsonString()));

    internal static string Sign(string privateKey, string data, string scheme)
    {
        var bytes = Encoding.UTF8.GetBytes(privateKey + data + privateKey);
#pragma warning disable CA5350 // LiqPay's signature is defined over SHA-1; it is not our choice.
        var hash = scheme == LiqPaySignatures.Sha3 ? SHA3_256.HashData(bytes) : SHA1.HashData(bytes);
#pragma warning restore CA5350
        return Convert.ToBase64String(hash);
    }

    /// <summary>Accepts either scheme: LiqPay signs callbacks the way the merchant account is set up.</summary>
    internal static bool Verify(string privateKey, string data, string signature)
    {
        var received = Encoding.ASCII.GetBytes(signature);
        return Matches(Sign(privateKey, data, LiqPaySignatures.Sha1))
               || (SHA3_256.IsSupported && Matches(Sign(privateKey, data, LiqPaySignatures.Sha3)));

        bool Matches(string expected) => CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), received);
    }

    private static bool IsNotFound(JsonObject response) =>
        Text(response, "err_code") is "payment_not_found" or "order_not_found" or "not_found";

    private string BaseUrl => options.Value.LiqPay.BaseUrl.TrimEnd('/');

    private async Task<LiqPayKeys> KeysAsync(CancellationToken ct) =>
        await credentials.LiqPayAsync(ct)
        ?? throw new InvalidOperationException("Не задано ключі LiqPay: вставте їх у консолі, розділ «Оплата й чеки».");

    private async Task<JsonObject> RequestAsync(JsonObject payload, CancellationToken ct, LiqPayKeys? use = null)
    {
        var keys = use ?? await KeysAsync(ct);
        payload["version"] = ApiVersion;
        payload["public_key"] = keys.PublicKey;
        var data = Encode(payload);
        using var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["data"] = data,
            ["signature"] = Sign(keys.PrivateKey, data, keys.Signature),
        });
        using var response = await http.PostAsync($"{BaseUrl}/api/request", content, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if ((int)response.StatusCode >= 500 || response.StatusCode is HttpStatusCode.RequestTimeout or HttpStatusCode.TooManyRequests)
        {
            // The outcome is unknown: the caller must not treat it as a refusal.
            throw new HttpRequestException($"LiqPay /api/request: {(int)response.StatusCode} {text}");
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new LiqPayRejectedException($"{(int)response.StatusCode} {text}");
        }

        try
        {
            return JsonNode.Parse(text) as JsonObject ?? throw new LiqPayRejectedException("Порожня відповідь LiqPay.");
        }
        catch (JsonException)
        {
            throw new LiqPayRejectedException($"Відповідь LiqPay не JSON: {text[..Math.Min(text.Length, 200)]}");
        }
    }

    private static string? Text(JsonObject payload, string name) => payload[name] switch
    {
        JsonValue value when value.TryGetValue<string>(out var s) => s,
        JsonValue value => value.ToJsonString(),
        _ => null,
    };

    private static decimal? Number(JsonObject payload, string name) => payload[name] switch
    {
        JsonValue value when decimal.TryParse(value.ToJsonString().Trim('"'), NumberStyles.Number | NumberStyles.AllowExponent, CultureInfo.InvariantCulture, out var parsed) => parsed,
        _ => null,
    };

    /// <summary>LiqPay sends dates as Unix milliseconds, as a number or a string.</summary>
    private static DateTimeOffset? Date(JsonObject payload, string name) =>
        Number(payload, name) is { } ms and > 0 ? DateTimeOffset.FromUnixTimeMilliseconds((long)ms) : null;
}

/// <summary>LiqPay refused the request (bad keys, wrong order); unlike a timeout, nothing happened on its side.</summary>
internal sealed class LiqPayRejectedException(string message) : InvalidOperationException(message);
