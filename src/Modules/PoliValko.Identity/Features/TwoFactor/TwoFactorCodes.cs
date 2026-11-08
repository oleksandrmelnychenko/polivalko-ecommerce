using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.TwoFactor;

internal static class TwoFactorCodes
{
    public const string Issuer = "Poli Valko";
    public const int RecoveryCodeCount = 10;

    public static bool LooksLikeAuthenticatorCode(string? code)
    {
        var token = Digits(code);
        return token.Length == 6 && token.All(char.IsAsciiDigit);
    }

    public static async Task<bool> VerifyAuthenticatorAsync(UserManager<StaffUser> users, StaffUser user, string? code)
    {
        if (!LooksLikeAuthenticatorCode(code))
        {
            return false;
        }

        return await users.VerifyTwoFactorTokenAsync(user, users.Options.Tokens.AuthenticatorTokenProvider, Digits(code));
    }

    public static async Task<bool> RedeemRecoveryCodeAsync(UserManager<StaffUser> users, StaffUser user, string? code)
    {
        var token = string.Concat((code ?? string.Empty).Where(c => !char.IsWhiteSpace(c))).ToUpperInvariant();
        if (token.Length == 10 && !token.Contains('-', StringComparison.Ordinal))
        {
            token = $"{token[..5]}-{token[5..]}";
        }

        return token.Length == 11 && (await users.RedeemTwoFactorRecoveryCodeAsync(user, token)).Succeeded;
    }

    public static string FormatKey(string key) =>
        string.Join(' ', key.ToLowerInvariant().Chunk(4).Select(part => new string(part)));

    public static string AuthenticatorUri(string email, string key)
    {
        var issuer = Uri.EscapeDataString(Issuer);
        return $"otpauth://totp/{issuer}:{Uri.EscapeDataString(email)}?secret={key}&issuer={issuer}&digits=6";
    }

    public static ProblemHttpResult LockedOut() =>
        Problems.Create(
            StatusCodes.Status403Forbidden,
            "auth.locked_out",
            "Обліковий запис тимчасово заблоковано",
            "Забагато невдалих спроб. Спробуйте через 15 хвилин або зверніться до адміністратора.");

    private static string Digits(string? code) =>
        string.Concat((code ?? string.Empty).Where(c => !char.IsWhiteSpace(c) && c != '-'));
}
