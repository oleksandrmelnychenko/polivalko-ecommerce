using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Features.Mail;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Recovery;

internal static class ForgotPassword
{
    public static async Task<Results<NoContent, ValidationProblem>> HandleAsync(
        ForgotPasswordRequest request,
        PoliValkoDbContext db,
        AccountMail mail,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var email = CustomerValidation.Email(request.Email, errors);
        if (email is null)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var normalized = CustomerEmail.Normalize(email);
        var customer = await db.Set<Customer>().AsNoTracking().FirstOrDefaultAsync(c => c.NormalizedEmail == normalized, ct);
        if (customer is not null)
        {
            var (token, value) = CustomerToken.Issue(customer.Id, CustomerTokenPurpose.PasswordReset, time.GetUtcNow());
            db.Add(token);
            await db.SaveChangesAsync(ct);
            await mail.SendPasswordResetAsync(customer, value, ct);
        }

        return TypedResults.NoContent();
    }
}
