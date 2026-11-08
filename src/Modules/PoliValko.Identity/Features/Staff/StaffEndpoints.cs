using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Staff;

internal static class StaffEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var users = console.MapGroup("/users").WithTags("Console").RequireStaff(PermissionKeys.StaffUsersManage);
        users.MapGet(string.Empty, ListStaffUsers.HandleAsync)
            .WithName("ConsoleListUsers")
            .WithSummary("Працівники та їхні ролі");
        users.MapPost(string.Empty, CreateStaffUser.HandleAsync)
            .WithName("ConsoleCreateUser")
            .WithSummary("Новий працівник з однією з ролей")
            .ProducesProblem(StatusCodes.Status403Forbidden);
        users.MapPut("/{id}", UpdateStaffUser.HandleAsync)
            .WithName("ConsoleUpdateUser")
            .WithSummary("Ім'я та роль працівника")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        users.MapPost("/{id}/lock", LockStaffUser.HandleAsync)
            .WithName("ConsoleLockUser")
            .WithSummary("Заблокувати або розблокувати доступ")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        users.MapPost("/{id}/password", ResetStaffPassword.HandleAsync)
            .WithName("ConsoleResetUserPassword")
            .WithSummary("Новий пароль працівнику; активні сесії завершуються")
            .ProducesProblem(StatusCodes.Status404NotFound);
        users.MapPost("/{id}/two-factor/reset", ResetStaffTwoFactor.HandleAsync)
            .WithName("ConsoleResetUserTwoFactor")
            .WithSummary("Вимкнути двофакторну перевірку працівнику, що втратив телефон; для адміністратора — з вашим кодом")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        console.MapGroup("/auth").WithTags("Console").RequireStaff()
            .MapPost("/password", ChangeOwnPassword.HandleAsync)
            .WithName("ConsoleChangeOwnPassword")
            .WithSummary("Зміна власного пароля");

        return console;
    }
}
