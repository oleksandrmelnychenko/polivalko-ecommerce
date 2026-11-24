using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Auth;

internal static class Logout
{
    public static async Task<NoContent> HandleAsync(HttpContext http, SignInManager<StaffUser> signInManager)
    {
        // A new security stamp ends every console session of this person, a copied cookie included.
        if (await signInManager.UserManager.GetUserAsync(http.User) is { } user)
            await signInManager.UserManager.UpdateSecurityStampAsync(user);
        await signInManager.SignOutAsync();
        return TypedResults.NoContent();
    }
}
