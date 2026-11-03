using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Idempotency;

namespace PoliValko.Payments.Features.Checkout;

internal static class PaymentEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Payments");

        group.MapPost("/orders/{number}/payments", StartPayment.HandleAsync)
            .RequireIdempotency<StartPaymentRequest>()
            .WithName("StartPayment")
            .WithSummary("Відкрити оплату карткою: посилання на сторінку провайдера. Повторно — та сама активна спроба або нова після відмови.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        group.MapPost("/payments/webhooks/{provider}", ReceiveWebhook.HandleAsync)
            .WithName("PaymentWebhook")
            .WithSummary("Повідомлення платіжного провайдера. Приймається лише з дійсним підписом; дублікати ігноруються.")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/payments/sandbox/{invoiceId}", GetSandboxInvoice.HandleAsync)
            .WithName("GetSandboxInvoice")
            .WithSummary("Тестова сторінка оплати: дані рахунку (лише Payments:Provider=Sandbox)")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/payments/sandbox/{invoiceId}/complete", CompleteSandboxPayment.HandleAsync)
            .WithName("CompleteSandboxPayment")
            .WithSummary("Тестова оплата: успіх, відмова або прострочення. notify=false імітує втрачений вебхук.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return api;
    }
}
