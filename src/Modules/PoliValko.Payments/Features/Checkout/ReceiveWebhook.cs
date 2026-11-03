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

        using var buffer = new MemoryStream();
        await http.Body.CopyToAsync(buffer, ct);
        var body = buffer.ToArray();

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

        await processor.ApplyAsync(handler.Name, status, "webhook", Encoding.UTF8.GetString(body), ct);
        return TypedResults.Ok();
    }
}
