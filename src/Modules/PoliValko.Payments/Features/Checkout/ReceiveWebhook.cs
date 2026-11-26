using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Web;
using PoliValko.Payments.Features.Processing;
using PoliValko.Payments.Integrations.Providers;

namespace PoliValko.Payments.Features.Checkout;

internal static class ReceiveWebhook
{
    private const int MaxBodyBytes = 256 * 1024;

    public static async Task<Results<Ok, ProblemHttpResult>> HandleAsync(
        string provider,
        HttpRequest http,
        IPaymentProviders providers,
        PaymentProcessor processor,
        ILoggerFactory loggers,
        CancellationToken ct)
    {
        if (providers.Find(provider) is not { } handler)
        {
            return Problems.NotFound("payments.unknown_provider", "Невідомий провайдер");
        }

        if (await ReadBodyAsync(http, ct) is not { } body)
        {
            return Problems.Create(StatusCodes.Status413PayloadTooLarge, "payments.webhook_too_large", "Повідомлення завелике");
        }

        ProviderPaymentStatus status;
        try
        {
            status = await handler.ParseWebhookAsync(body, http.Headers, ct);
        }
        catch (Exception ex) when (ex is PaymentWebhookRejectedException or System.Text.Json.JsonException)
        {
            loggers.CreateLogger(typeof(ReceiveWebhook)).LogWarning("Оплата: відхилено повідомлення {Provider}: {Reason}", provider, ex.Message);
            return Problems.Create(StatusCodes.Status400BadRequest, "payments.webhook_rejected", "Повідомлення не прийнято");
        }

        await processor.ApplyAsync(handler.Name, status, "webhook", status.Payload ?? Encoding.UTF8.GetString(body), ct);
        return TypedResults.Ok();
    }

    private static async Task<byte[]?> ReadBodyAsync(HttpRequest http, CancellationToken ct)
    {
        if (http.ContentLength > MaxBodyBytes)
        {
            return null;
        }

        using var buffer = new MemoryStream();
        var chunk = new byte[8192];
        int read;
        while ((read = await http.Body.ReadAsync(chunk, ct)) > 0)
        {
            if (buffer.Length + read > MaxBodyBytes)
            {
                return null;
            }

            buffer.Write(chunk, 0, read);
        }

        return buffer.ToArray();
    }
}
