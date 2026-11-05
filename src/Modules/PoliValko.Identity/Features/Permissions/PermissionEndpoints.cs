using System.Security.Claims;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Permissions;

internal static class PermissionEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/permissions").WithTags("Console").RequireStaff();
        group.MapGet("/catalog", GetCatalog)
            .WithName("ConsolePermissionCatalog")
            .WithSummary("Каталог прав консолі: ключі, назви, розділи й ризик");
        group.MapGet("/me", GetMineAsync)
            .WithName("ConsoleMyPermissions")
            .WithSummary("Роль і права поточного працівника");
        return console;
    }

    private static Ok<PermissionCatalogDto> GetCatalog() =>
        TypedResults.Ok(new PermissionCatalogDto(
            PermissionCatalog.Version,
            PermissionCatalog.Permissions
                .Select(p => new PermissionDefinitionDto(p.Key, p.Name, p.Description, p.SectionId, p.SectionLabel, p.Risk))
                .ToList()));

    private static async Task<Ok<MyPermissionsDto>> GetMineAsync(
        ClaimsPrincipal user,
        HttpContext http,
        IStaffAccessResolver resolver,
        CancellationToken ct)
    {
        var access = await resolver.GetStaffAccessAsync(user, http.Items, ct);
        return TypedResults.Ok(access is null
            ? new MyPermissionsDto(string.Empty, string.Empty, false, [], PermissionCatalog.Version)
            : new MyPermissionsDto(access.RoleId, access.RoleName, access.IsSuperuser, PermissionCatalog.Order(access.PermissionKeys), PermissionCatalog.Version));
    }
}
