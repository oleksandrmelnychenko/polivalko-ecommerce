using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Staff;

internal static class LockStaffUser
{
    public static async Task<Results<Ok<StaffUserDto>, ProblemHttpResult>> HandleAsync(
        string id,
        LockStaffUserRequest request,
        ClaimsPrincipal me,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        if (request.Locked && StaffValidation.IsSelf(me, user))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "auth.self_lock", "Не можна заблокувати власний обліковий запис");
        }

        await userManager.SetLockoutEndDateAsync(user, request.Locked ? DateTimeOffset.MaxValue : null);
        await userManager.ResetAccessFailedCountAsync(user);
        await userManager.UpdateSecurityStampAsync(user);
        audit.Record(request.Locked ? "user.locked" : "user.unlocked", "StaffUser", user.Email);
        await db.SaveChangesAsync();
        return TypedResults.Ok(await StaffMapping.ToDtoAsync(userManager, user, time));
    }
}
