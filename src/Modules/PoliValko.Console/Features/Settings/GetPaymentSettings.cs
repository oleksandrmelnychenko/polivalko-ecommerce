using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PoliValko.Fiscal.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Contracts;

namespace PoliValko.Console.Features.Settings;

internal static class GetPaymentSettings
{
    public static async Task<Ok<PaymentSettingsDto>> HandleAsync(
        PoliValkoDbContext db,
        [FromServices] IPaymentSettings payments,
        [FromServices] IFiscalSettings fiscal,
        CancellationToken ct)
    {
        var lastReconcileAt = await db.Set<SyncState>()
            .AsNoTracking()
            .Where(s => s.Job == PaymentJobs.Reconcile)
            .Select(s => s.LastSuccessAt)
            .FirstOrDefaultAsync(ct);

        return TypedResults.Ok(new PaymentSettingsDto(
            payments.Provider,
            payments.Mode,
            lastReconcileAt,
            fiscal.Provider,
            fiscal.Mode,
            new ReceiptIssueDto(
                fiscal.IssueOn(PaymentMethod.Card),
                fiscal.IssueOn(PaymentMethod.CashOnDelivery),
                fiscal.IssueOn(PaymentMethod.PayOnPickup))));
    }
}
