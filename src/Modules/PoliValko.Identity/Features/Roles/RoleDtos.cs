namespace PoliValko.Identity.Features.Roles;

public sealed record StaffRoleDto(
    string Id,
    string Name,
    string? Description,
    bool IsSystem,
    bool IsSuperuser,
    int UserCount,
    int PermissionCount,
    long Version,
    DateTimeOffset? UpdatedAt,
    string? UpdatedBy);

public sealed record SaveStaffRoleRequest(string? Name, string? Description, string? CopyFromRoleId);

public sealed record RolePermissionsDto(
    string RoleId,
    long Version,
    IReadOnlyList<string> PermissionKeys,
    bool IsSuperuser,
    DateTimeOffset? UpdatedAt,
    string? UpdatedBy,
    string CatalogVersion);

public sealed record UpdateRolePermissionsRequest(long ExpectedVersion, IReadOnlyList<string>? PermissionKeys);
