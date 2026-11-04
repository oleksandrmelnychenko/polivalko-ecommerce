using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Features.Mail;
using PoliValko.Customers.Persistence;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Customers.Features.Confirmation;

internal static class ResendConfirmation
{
    public static async Task<Results<NoContent, ProblemHttpResult>> HandleAsync(
        HttpContext http,
        PoliValkoDbContext db,
        AccountMail mail,
        TimeProvider time,
        CancellationToken ct)
    {
        var customer = await CustomerLoader.LoadAsync(db, http.User, ct);
        if (customer is null)
        {
            return AccountProblems.SignedOut();
        }

        if (customer.EmailConfirmedAt is not null)
        {
            return TypedResults.NoContent();
        }

        var (token, value) = CustomerToken.Issue(customer.Id, CustomerTokenPurpose.EmailConfirmation, time.GetUtcNow());
        db.Add(token);
        await db.SaveChangesAsync(ct);

        if (!await mail.SendConfirmationAsync(customer, value, ct))
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
