using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Staff;

internal static class StaffMapping
{
    public static async Task<StaffUserDto> ToDtoAsync(UserManager<StaffUser> userManager, StaffUser user, TimeProvider time) =>
        new(user.Id, user.Email ?? string.Empty, user.DisplayName, (await userManager.GetRolesAsync(user)).ToList(), user.LockoutEnd > time.GetUtcNow());

    public static ProblemHttpResult UserNotFound() => Problems.NotFound("auth.user_not_found", "Працівника не знайдено");
}
