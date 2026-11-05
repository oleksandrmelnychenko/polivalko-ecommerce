using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Customers.Features.Auth;

internal static class Login
{
    public static async Task<Results<Ok<CustomerMeDto>, ProblemHttpResult>> HandleAsync(
        CustomerLoginRequest request,
        HttpContext http,
        PoliValkoDbContext db,
        CustomerPasswords passwords,
        TimeProvider time,
        CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var normalized = string.IsNullOrWhiteSpace(request.Email) ? null : CustomerEmail.Normalize(request.Email);
        var customer = normalized is null ? null : await db.Set<Customer>().FirstOrDefaultAsync(c => c.NormalizedEmail == normalized, ct);
        if (customer is null
            || string.IsNullOrEmpty(request.Password)
            || request.Password.Length > CustomerValidation.MaxPasswordLength
            || customer.IsLockedOut(now))
        {
            passwords.VerifyPlaceholder(request.Password?[..Math.Min(request.Password.Length, CustomerValidation.MaxPasswordLength)]);
            return InvalidCredentials();
        }

        var result = passwords.Verify(customer, request.Password);
        if (result == PasswordVerificationResult.Failed)
        {
            customer.RecordFailedLogin(now);
            await db.SaveChangesAsync(ct);
            return InvalidCredentials();
        }

        if (customer.BlockedAt is not null)
        {
            return Problems.Create(
                StatusCodes.Status403Forbidden,
                "account.blocked",
                "Обліковий запис заблоковано",
                "Зверніться до магазину, щоб розблокувати кабінет.");
        }

        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            customer.RehashPassword(passwords.Hash(customer, request.Password));
        }

        customer.ClearLockout();
        await db.SaveChangesAsync(ct);
        await CustomerSession.SignInAsync(http, customer);
        return TypedResults.Ok(CustomerMapping.ToMe(customer));
    }

    private static ProblemHttpResult InvalidCredentials() =>
        Problems.Create(
            StatusCodes.Status401Unauthorized,
            "account.invalid_credentials",
            "Невірний email або пароль",
            "Після 5 невдалих спроб вхід блокується на 15 хвилин. Якщо забули пароль, відновіть його через email.");
}
