using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Features.Processing;
using PoliValko.Payments.Integrations.Providers;
using PoliValko.Payments.Integrations.Sandbox;

namespace PoliValko.Payments.Features.Checkout;

internal static class CompleteSandboxPayment
{
    public static async Task<Results<Ok<SandboxCompletionDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string invoiceId,
        CompleteSandboxPaymentRequest request,
        IPaymentProviders providers,
        PaymentProcessor processor,
        PoliValkoDbContext db,
        TimeProvider time,
        CancellationToken ct)
    {
        if (providers.Active is not SandboxPaymentProvider provider)
        {
            return Problems.NotFound("http.not_found", "Не знайдено");
        }

        var outcome = request.Outcome switch
        {
            "success" => "success",
            "failure" => "failure",
            "expired" => "expired",
            _ => null,
        };
        if (outcome is null)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["outcome"] = ["Допустимі значення: success, failure, expired."] });
        }

        var invoice = await db.Set<SandboxInvoice>().FirstOrDefaultAsync(i => i.Id == invoiceId, ct);
        if (invoice is null)
        {
            return Problems.NotFound("payments.invoice_not_found", "Рахунок не знайдено");
        }

        if (invoice.Status is not ("created" or "processing"))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "payments.invoice_closed", "Рахунок уже закрито", $"Стан рахунку: {invoice.Status}.");
        }

        invoice.Status = outcome;
        invoice.ModifiedAt = time.GetUtcNow();
        await db.SaveChangesAsync(ct);

        if (request.Notify != false)
        {
            var (body, signature) = provider.BuildWebhook(invoice);
            var headers = new HeaderDictionary { [SandboxPaymentProvider.SignatureHeader] = signature };
            var status = await provider.ParseWebhookAsync(body, headers, ct);
            await processor.ApplyAsync(provider.Name, status, "sandbox", Encoding.UTF8.GetString(body), ct);
        }

        return TypedResults.Ok(new SandboxCompletionDto(invoice.Status, invoice.RedirectUrl));
    }
}
