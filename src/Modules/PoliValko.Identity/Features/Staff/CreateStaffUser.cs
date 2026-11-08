using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Identity.Features.TwoFactor;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Staff;

internal static class CreateStaffUser
{
    public static async Task<Results<Created<StaffUserDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        CreateStaffUserRequest request,
        ClaimsPrincipal me,
        HttpContext http,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IStaffAccessResolver access,
        IAuditLog audit,
        TimeProvider time,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var email = request.Email?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > 200 || !email.Contains('@', StringComparison.Ordinal))
        {
            errors["email"] = ["Вкажіть робочий email."];
        }
        else if (await userManager.FindByEmailAsync(email) is not null)
        {
            errors["email"] = ["Працівник з таким email уже є."];
        }

        var name = StaffValidation.ValidateName(request.DisplayName, errors);
        var role = await StaffValidation.ValidateRoleAsync(request.RoleId, db, errors, ct);
        if (string.IsNullOrEmpty(request.Password))
        {
            errors["password"] = ["Вкажіть початковий пароль."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var mine = await access.GetStaffAccessAsync(me, http.Items, ct);
        if (await StaffValidation.CanGrantAsync(mine, role!, db, ct) is { } denied)
        {
            return denied;
        }

        if (role!.IsSuperuser && await SuperuserConfirmation.CheckAsync(me, request.TwoFactorCode, userManager) is { } unconfirmed)
        {
            return unconfirmed;
        }

        var user = new StaffUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = name! };
        var created = await userManager.CreateAsync(user, request.Password!);
        if (!created.Succeeded)
        {
            return TypedResults.ValidationProblem(StaffValidation.ToErrors(created));
        }

        await userManager.AddToRoleAsync(user, role!.Name!);
        audit.Record("user.created", "StaffUser", email, new { name, role = role.DisplayName, confirmedByCode = role.IsSuperuser });
        await db.SaveChangesAsync(ct);
        access.Invalidate();
        return TypedResults.Created($"/api/v1/console/users/{user.Id}", await StaffMapping.ToDtoAsync(db, user, time, ct));
    }
}
