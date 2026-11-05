using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Roles;

internal static class RoleEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var roles = console.MapGroup("/roles").WithTags("Console").RequireStaff();

        roles.MapGet(string.Empty, ListRoles.HandleAsync)
            .RequirePermission(PermissionKeys.StaffRolesManage, PermissionKeys.StaffUsersManage)
            .WithName("ConsoleListRoles")
            .WithSummary("Ролі працівників: кількість людей і прав, версія");
        roles.MapPost(string.Empty, CreateRole.HandleAsync)
            .RequirePermission(PermissionKeys.StaffRolesManage)
            .WithName("ConsoleCreateRole")
            .WithSummary("Нова роль; права можна скопіювати з іншої ролі");
        roles.MapPut("/{id}", UpdateRole.HandleAsync)
            .RequirePermission(PermissionKeys.StaffRolesManage)
            .WithName("ConsoleUpdateRole")
            .WithSummary("Назва й опис ролі")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        roles.MapDelete("/{id}", DeleteRole.HandleAsync)
            .RequirePermission(PermissionKeys.StaffRolesManage)
            .WithName("ConsoleDeleteRole")
            .WithSummary("Видалення ролі без працівників")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);
        roles.MapGet("/{id}/permissions", GetRolePermissions.HandleAsync)
            .RequirePermission(PermissionKeys.StaffRolesManage)
            .WithName("ConsoleGetRolePermissions")
            .WithSummary("Права ролі та їхня версія")
            .ProducesProblem(StatusCodes.Status404NotFound);
        roles.MapPut("/{id}/permissions", UpdateRolePermissions.HandleAsync)
            .RequirePermission(PermissionKeys.StaffRolesManage)
            .WithName("ConsoleUpdateRolePermissions")
            .WithSummary("Повний набір прав ролі з перевіркою версії")
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return console;
    }
}
