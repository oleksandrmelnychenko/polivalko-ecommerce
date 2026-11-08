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

internal static class ResetStaffTwoFactor
{
    public static async Task<Results<Ok<StaffUserDto>, ProblemHttpResult>> HandleAsync(
        string id,
        ResetStaffTwoFactorRequest request,
        ClaimsPrincipal me,
        HttpContext http,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IStaffAccessResolver access,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        if (StaffValidation.IsSelf(me, user))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "auth.self_two_factor", "Власну перевірку вимикають у меню профілю", "Там потрібен код із вашого застосунку.");
        }

        if (await StaffValidation.CanManageAsync(await access.GetStaffAccessAsync(me, http.Items, ct), user, db, ct) is { } denied)
        {
            return denied;
        }

        if (!await userManager.GetTwoFactorEnabledAsync(user))
        {
            return Problems.Create(StatusCodes.Status409Conflict, "two_factor.not_enabled", "У працівника двофакторну перевірку не ввімкнено");
        }

        var role = await StaffMapping.StaffRolesOf(db, user.Id).AsNoTracking().FirstOrDefaultAsync(ct);
        if (role?.IsSuperuser == true && await SuperuserConfirmation.CheckAsync(me, request.TwoFactorCode, userManager) is { } unconfirmed)
        {
            return unconfirmed;
        }

        await OwnTwoFactor.TurnOffAsync(userManager, user);
        audit.Record("user.two_factor_reset", "StaffUser", user.Email);
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(await StaffMapping.ToDtoAsync(db, user, time, ct));
    }
}
