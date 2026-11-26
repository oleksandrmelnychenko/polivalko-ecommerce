using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PoliValko.Fiscal.Contracts;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Sync;
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

        var summary = await payments.GetAsync(ct);
        var receipts = await fiscal.GetAsync(ct);
        return TypedResults.Ok(new PaymentSettingsDto(
            summary.Provider,
            summary.Mode,
            lastReconcileAt,
            receipts.Provider,
            receipts.Mode,
            new ReceiptIssueDto(receipts.Card, receipts.CashOnDelivery, receipts.Pickup)));
    }
}
