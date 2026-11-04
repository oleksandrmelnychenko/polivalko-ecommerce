using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Mail;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Features.Auth;

internal static class Register
{
    public static async Task<Results<Created<CustomerMeDto>, ValidationProblem>> HandleAsync(
        RegisterCustomerRequest request,
        HttpContext http,
        PoliValkoDbContext db,
        CustomerPasswords passwords,
        AccountMail mail,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var email = CustomerValidation.Email(request.Email, errors);
        var name = CustomerValidation.Name(request.Name, errors);
        var phone = CustomerValidation.Phone(request.Phone, errors);
        CustomerValidation.Password(request.Password, email, "password", errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var normalized = CustomerEmail.Normalize(email!);
        if (await db.Set<Customer>().AnyAsync(c => c.NormalizedEmail == normalized, ct))
        {
            return Duplicate();
        }

        var now = time.GetUtcNow();
        var customer = new Customer
        {
            Id = Guid.CreateVersion7(now),
            Email = email!,
            NormalizedEmail = normalized,
            Name = name!,
            Phone = phone,
            CreatedAt = now,
        };
        customer.ChangePassword(passwords.Hash(customer, request.Password!));
        var (token, value) = CustomerToken.Issue(customer.Id, CustomerTokenPurpose.EmailConfirmation, now);
        db.Add(customer);
        db.Add(token);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Duplicate();
        }

        await CustomerSession.SignInAsync(http, customer);
        await mail.SendConfirmationAsync(customer, value, ct);
        return TypedResults.Created("/api/v1/account/me", CustomerMapping.ToMe(customer));
    }

    private static ValidationProblem Duplicate() =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]>
        {
            ["email"] = ["Обліковий запис з таким email уже існує. Увійдіть або відновіть пароль."],
        });
}
