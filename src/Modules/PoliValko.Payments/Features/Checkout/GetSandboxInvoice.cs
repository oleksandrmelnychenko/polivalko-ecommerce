using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;
using PoliValko.Payments.Domain;
using PoliValko.Payments.Integrations.Providers;
using PoliValko.Payments.Integrations.Sandbox;
using PoliValko.SharedKernel;

namespace PoliValko.Payments.Features.Checkout;

internal static class GetSandboxInvoice
{
    public static async Task<Results<Ok<SandboxInvoiceDto>, ProblemHttpResult>> HandleAsync(
        string invoiceId,
        IPaymentProviders providers,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        if (providers.Active?.Name != PaymentProviderNames.Sandbox)
        {
            return Problems.NotFound("http.not_found", "Не знайдено");
        }

        var provider = (SandboxPaymentProvider)providers.Active;
        var status = await db.Set<SandboxInvoice>().AnyAsync(i => i.Id == invoiceId, ct)
            ? await provider.GetStatusAsync(invoiceId, ct)
            : null;
        var invoice = await db.Set<SandboxInvoice>().AsNoTracking().FirstOrDefaultAsync(i => i.Id == invoiceId, ct);
        return invoice is null || status is null
            ? Problems.NotFound("payments.invoice_not_found", "Рахунок не знайдено")
            : TypedResults.Ok(new SandboxInvoiceDto(invoice.Id, invoice.OrderNumber, MoneyDto.Hryvnia(invoice.Amount), invoice.Status, invoice.ExpiresAt));
    }
}
