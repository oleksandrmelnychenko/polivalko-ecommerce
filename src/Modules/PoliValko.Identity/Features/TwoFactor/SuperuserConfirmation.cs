using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.TwoFactor;

internal static class SuperuserConfirmation
{
    public static async Task<ProblemHttpResult?> CheckAsync(ClaimsPrincipal me, string? code, UserManager<StaffUser> users)
    {
        var actor = await users.GetUserAsync(me);
        if (actor is null || !await users.GetTwoFactorEnabledAsync(actor))
        {
            return Problems.Create(
                StatusCodes.Status403Forbidden,
                "staff.two_factor_setup_required",
                "Увімкніть двофакторну перевірку",
                "Роль адміністратора призначається лише з підтвердженням кодом. Увімкніть двофакторну перевірку в меню профілю.");
        }

        if (await users.IsLockedOutAsync(actor))
        {
            return TwoFactorCodes.LockedOut();
        }

        if (string.IsNullOrWhiteSpace(code))
        {
            return Problems.Create(
                StatusCodes.Status403Forbidden,
                "staff.two_factor_required",
                "Потрібен код підтвердження",
                "Введіть шестизначний код із застосунку-автентифікатора.");
        }

        if (!await TwoFactorCodes.VerifyAuthenticatorAsync(users, actor, code))
        {
            await users.AccessFailedAsync(actor);
            return await users.IsLockedOutAsync(actor)
                ? TwoFactorCodes.LockedOut()
                : Problems.Create(
                    StatusCodes.Status403Forbidden,
                    "staff.two_factor_invalid",
                    "Код не підходить",
                    "Перевірте, що час на телефоні виставлено автоматично, і введіть новий код.");
        }

        await users.ResetAccessFailedCountAsync(actor);
        return null;
    }
}
