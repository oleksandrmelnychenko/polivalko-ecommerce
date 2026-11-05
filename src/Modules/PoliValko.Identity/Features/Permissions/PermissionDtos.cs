using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Permissions;

public sealed record PermissionDefinitionDto(
    string Key,
    string Name,
    string? Description,
    string SectionId,
    string SectionLabel,
    PermissionRisk Risk);

public sealed record PermissionCatalogDto(string Version, IReadOnlyList<PermissionDefinitionDto> Permissions);

public sealed record MyPermissionsDto(
    string RoleId,
    string RoleName,
    bool IsSuperuser,
    IReadOnlyList<string> PermissionKeys,
    string CatalogVersion);
