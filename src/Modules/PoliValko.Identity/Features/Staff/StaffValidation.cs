using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Staff;

internal static class StaffValidation
{
    public static string? ValidateName(string? value, Dictionary<string, string[]> errors)
    {
        var name = value?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > 100)
        {
            errors["displayName"] = ["Вкажіть ім'я до 100 символів: воно видно в історії замовлень."];
        }

        return name;
    }

    public static string? ValidateRole(string? role, Dictionary<string, string[]> errors)
    {
        if (!StaffRoles.All.Contains(role))
        {
            errors["role"] = ["Роль: Admin або Manager."];
            return null;
        }

        return role;
    }

    public static Dictionary<string, string[]> ToErrors(IdentityResult result, string field = "password")
    {
        var messages = result.Errors.Select(e => e.Code switch
        {
            "PasswordTooShort" => "Пароль має містити щонайменше 10 символів.",
            "PasswordRequiresDigit" => "Додайте в пароль цифру.",
            "PasswordRequiresLower" => "Додайте в пароль малу літеру.",
            "PasswordRequiresUpper" => "Додайте в пароль велику літеру.",
            "PasswordRequiresNonAlphanumeric" => "Додайте в пароль символ, що не є літерою чи цифрою.",
            "PasswordMismatch" => "Поточний пароль невірний.",
            "DuplicateEmail" or "DuplicateUserName" => "Працівник з таким email уже є.",
            "InvalidEmail" or "InvalidUserName" => "Перевірте email.",
            _ => e.Description,
        }).Distinct().ToArray();
        var key = result.Errors.Any(e => e.Code.Contains("Email", StringComparison.Ordinal) || e.Code.Contains("UserName", StringComparison.Ordinal)) ? "email" : field;
        return new() { [key] = messages };
    }

    public static bool IsSelf(ClaimsPrincipal me, StaffUser user) => me.FindFirstValue(ClaimTypes.NameIdentifier) == user.Id;
}
