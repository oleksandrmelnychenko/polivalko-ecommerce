using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.Staff;

internal static class StaffEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        var users = admin.MapGroup("/users").WithTags("Admin").RequireStaff(StaffPolicies.Admin);
        users.MapGet(string.Empty, ListStaffUsers.HandleAsync)
            .WithName("AdminListUsers")
            .WithSummary("Працівники та їхні ролі (лише адміністратор)");
        users.MapPost(string.Empty, CreateStaffUser.HandleAsync)
            .WithName("AdminCreateUser")
            .WithSummary("Новий працівник з роллю адміністратора або менеджера");
        users.MapPut("/{id}", UpdateStaffUser.HandleAsync)
            .WithName("AdminUpdateUser")
            .WithSummary("Ім'я та роль працівника")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        users.MapPost("/{id}/lock", LockStaffUser.HandleAsync)
            .WithName("AdminLockUser")
            .WithSummary("Заблокувати або розблокувати доступ")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        users.MapPost("/{id}/password", ResetStaffPassword.HandleAsync)
            .WithName("AdminResetUserPassword")
            .WithSummary("Новий пароль працівнику; активні сесії завершуються")
            .ProducesProblem(StatusCodes.Status404NotFound);

        admin.MapGroup("/auth").WithTags("Admin").RequireStaff()
            .MapPost("/password", ChangeOwnPassword.HandleAsync)
            .WithName("AdminChangeOwnPassword")
            .WithSummary("Зміна власного пароля");

        return admin;
    }
}
