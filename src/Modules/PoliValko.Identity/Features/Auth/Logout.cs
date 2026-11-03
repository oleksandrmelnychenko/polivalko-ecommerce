using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Auth;

internal static class Logout
{
    public static async Task<NoContent> HandleAsync(SignInManager<StaffUser> signInManager)
    {
        await signInManager.SignOutAsync();
        return TypedResults.NoContent();
    }
}
