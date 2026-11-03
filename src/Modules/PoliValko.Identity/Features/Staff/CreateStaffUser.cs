using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Staff;

internal static class CreateStaffUser
{
    public static async Task<Results<Created<StaffUserDto>, ValidationProblem>> HandleAsync(
        CreateStaffUserRequest request,
        UserManager<StaffUser> userManager,
        PoliValkoDbContext db,
        IAuditLog audit,
        TimeProvider time)
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
        var role = StaffValidation.ValidateRole(request.Role, errors);
        if (string.IsNullOrEmpty(request.Password))
        {
            errors["password"] = ["Вкажіть початковий пароль."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var user = new StaffUser { UserName = email, Email = email, EmailConfirmed = true, DisplayName = name! };
        var created = await userManager.CreateAsync(user, request.Password!);
        if (!created.Succeeded)
        {
            return TypedResults.ValidationProblem(StaffValidation.ToErrors(created));
        }

        await userManager.AddToRoleAsync(user, role!);
        audit.Record("user.created", "StaffUser", email, new { name, role });
        await db.SaveChangesAsync();
        return TypedResults.Created($"/api/v1/admin/users/{user.Id}", await StaffMapping.ToDtoAsync(userManager, user, time));
    }
}
