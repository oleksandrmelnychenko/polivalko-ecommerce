using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
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
        IStaffAccessResolver access,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        await using var transaction = await StaffValidation.BeginChangeAsync(db, ct);
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        if (request.Locked && StaffValidation.IsSelf(me, user))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "auth.self_lock", "Не можна заблокувати власний обліковий запис");
        }

        if (await StaffValidation.CanManageAsync(await access.GetStaffAccessAsync(me, null, ct), user, db, ct) is { } denied)
        {
            return denied;
        }

        if (request.Locked && await StaffValidation.IsLastActiveSuperuserAsync(db, user, time, ct))
        {
            return StaffValidation.LastSuperuser();
        }

        if (!(await userManager.SetLockoutEndDateAsync(user, request.Locked ? DateTimeOffset.MaxValue : null)).Succeeded
            || !(await userManager.ResetAccessFailedCountAsync(user)).Succeeded
            || !(await userManager.UpdateSecurityStampAsync(user)).Succeeded)
        {
            return StaffValidation.UpdateConflict();
        }

        audit.Record(request.Locked ? "user.locked" : "user.unlocked", "StaffUser", user.Email);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        access.Invalidate();
        return TypedResults.Ok(await StaffMapping.ToDtoAsync(db, user, time, ct));
    }
}
