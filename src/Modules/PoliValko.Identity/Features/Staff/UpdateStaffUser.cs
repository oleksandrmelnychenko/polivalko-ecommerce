using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PoliValko.Identity.Features.TwoFactor;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Identity.Features.Staff;

internal static class UpdateStaffUser
{
    public static async Task<Results<Ok<StaffUserDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string id,
        UpdateStaffUserRequest request,
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

        var errors = new Dictionary<string, string[]>();
        var name = StaffValidation.ValidateName(request.DisplayName, errors);
        if (!string.Equals(name, user.DisplayName, StringComparison.Ordinal))
        {
            await StaffValidation.ValidateNameIsFreeAsync(name, user.Id, db, errors, ct);
        }
        var role = await StaffValidation.ValidateRoleAsync(request.RoleId, db, errors, ct);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var mine = await access.GetStaffAccessAsync(me, null, ct);
        if (await StaffValidation.CanManageAsync(mine, user, db, ct) is { } cannotManage)
        {
            return cannotManage;
        }

        var current = await StaffMapping.StaffRolesOf(db, user.Id).AsNoTracking().FirstOrDefaultAsync(ct);
        var roleChanges = current?.Id != role!.Id;
        if (roleChanges)
        {
            if (StaffValidation.IsSelf(me, user))
            {
                return Problems.Create(StatusCodes.Status409Conflict, "auth.self_role", "Не можна змінити власну роль", "Попросіть іншого адміністратора.");
            }

            if (await StaffValidation.CanGrantAsync(mine, role, db, ct) is { } cannotGrant)
            {
                return cannotGrant;
            }

            if (role.IsSuperuser && await SuperuserConfirmation.CheckAsync(me, request.TwoFactorCode, userManager) is { } unconfirmed)
            {
                await transaction.CommitAsync(ct);
                return unconfirmed;
            }

            if (current?.IsSuperuser == true && !role.IsSuperuser && await StaffValidation.IsLastActiveSuperuserAsync(db, user, time, ct))
            {
                return StaffValidation.LastSuperuser();
            }
        }

        var before = new { user.DisplayName, role = current?.DisplayName };
        user.DisplayName = name!;
        if (!(await userManager.UpdateAsync(user)).Succeeded)
        {
            return StaffValidation.UpdateConflict();
        }

        if (roleChanges)
        {
            if (!(await userManager.RemoveFromRolesAsync(user, await userManager.GetRolesAsync(user))).Succeeded
                || !(await userManager.AddToRoleAsync(user, role.Name!)).Succeeded
                || !(await userManager.UpdateSecurityStampAsync(user)).Succeeded)
            {
                return StaffValidation.UpdateConflict();
            }
        }

        audit.Record("user.updated", "StaffUser", user.Email, new { before, after = new { name, role = role.DisplayName } });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        access.Invalidate();
        return TypedResults.Ok(await StaffMapping.ToDtoAsync(db, user, time, ct));
    }
}
