using System.Net.Mail;
using PoliValko.SharedKernel;

namespace PoliValko.Customers.Features.Auth;

internal static class CustomerValidation
{
    public const int MinPasswordLength = 8;
    public const int MaxPasswordLength = 128;

    public static string? Email(string? value, Dictionary<string, string[]> errors)
    {
        var email = value?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > 200 || !MailAddress.TryCreate(email, out var parsed) || parsed.Address != email)
        {
            errors["email"] = ["Вкажіть email у форматі name@example.com."];
            return null;
        }

        return email;
    }

    public static string? Name(string? value, Dictionary<string, string[]> errors)
    {
        var name = value?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length is < 2 or > 100)
        {
            errors["name"] = ["Вкажіть ім'я (від 2 до 100 символів)."];
            return null;
        }

        return name;
    }

    public static string? Phone(string? value, Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (!PhoneNumber.TryNormalizeUa(value, out var phone))
        {
            errors["phone"] = ["Вкажіть український номер телефону, наприклад +380 67 123 45 67."];
            return null;
        }

        return phone;
    }

    public static void Password(string? password, string? email, string key, Dictionary<string, string[]> errors)
    {
        if (string.IsNullOrEmpty(password) || password.Length is < MinPasswordLength or > MaxPasswordLength)
        {
            errors[key] = [$"Пароль має містити від {MinPasswordLength} до {MaxPasswordLength} символів."];
        }
        else if (email is not null && string.Equals(password.Trim(), email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            errors[key] = ["Пароль не може збігатися з email."];
        }
    }
}
