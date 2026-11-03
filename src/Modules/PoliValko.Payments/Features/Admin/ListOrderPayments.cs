using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Payments.Domain;
using PoliValko.SharedKernel;

namespace PoliValko.Payments.Features.Admin;

internal static class ListOrderPayments
{
    public static async Task<Ok<List<AdminPaymentDto>>> HandleAsync(string number, PoliValkoDbContext db, CancellationToken ct)
    {
        var payments = await db.Set<Payment>()
            .AsNoTracking()
            .Where(p => p.OrderNumber == number)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new
            {
                Payment = p,
                Events = db.Set<PaymentEvent>().Count(e => e.PaymentId == p.Id),
            })
            .ToListAsync(ct);

        return TypedResults.Ok(payments.Select(x => new AdminPaymentDto(
                x.Payment.Id,
                x.Payment.Provider,
                x.Payment.ProviderPaymentId,
                MoneyDto.Hryvnia(x.Payment.Amount),
                x.Payment.Status,
                x.Payment.CreatedAt,
                x.Payment.UpdatedAt,
                x.Payment.FailureReason,
                x.Events))
            .ToList());
    }
}
