using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Mail;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Customers.Features.Console;

internal static class SendAccountPasswordReset
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        Guid id,
        PoliValkoDbContext db,
        AccountMail mail,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var customer = await db.Set<Customer>().AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct);
        if (customer is null)
        {
            return ConsoleAccountMapping.NotFound();
        }

        var (token, value) = CustomerToken.Issue(customer.Id, CustomerTokenPurpose.PasswordReset, time.GetUtcNow());
        db.Add(token);
        audit.Record("customer.password_reset_sent", "Customer", customer.Id.ToString(), new { customer.Email });
        await db.SaveChangesAsync(ct);

        if (!await mail.SendPasswordResetAsync(customer, value, ct))
        {
            return Problems.Create(
                StatusCodes.Status503ServiceUnavailable,
                "account.mail_unavailable",
                "Лист не надіслано",
                "Спробуйте ще раз за кілька хвилин.");
        }

        return TypedResults.NoContent();
    }
}
