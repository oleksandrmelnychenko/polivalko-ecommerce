using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
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
        IAuditLog audit,
        TimeProvider time)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return StaffMapping.UserNotFound();
        }

        var errors = new Dictionary<string, string[]>();
        var name = StaffValidation.ValidateName(request.DisplayName, errors);
        var role = StaffValidation.ValidateRole(request.Role, errors);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var roles = await userManager.GetRolesAsync(user);
        if (StaffValidation.IsSelf(me, user) && role != StaffRoles.Admin)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "auth.self_demotion", "Не можна зняти з себе роль адміністратора", "Попросіть іншого адміністратора.");
        }

        var before = new { user.DisplayName, roles };
        user.DisplayName = name!;
        await userManager.UpdateAsync(user);
        if (!roles.Contains(role!))
        {
            await userManager.RemoveFromRolesAsync(user, roles);
            await userManager.AddToRoleAsync(user, role!);
            await userManager.UpdateSecurityStampAsync(user);
        }

        audit.Record("user.updated", "StaffUser", user.Email, new { before, after = new { name, role } });
        await db.SaveChangesAsync();
        return TypedResults.Ok(await StaffMapping.ToDtoAsync(userManager, user, time));
    }
}
