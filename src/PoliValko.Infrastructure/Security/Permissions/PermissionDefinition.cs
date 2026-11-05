namespace PoliValko.Infrastructure.Security.Permissions;

public sealed record PermissionDefinition(
    string Key,
    string Name,
    string? Description,
    string SectionId,
    string SectionLabel,
    PermissionRisk Risk);

public enum PermissionRisk
{
    Low,
    Medium,
    High,
}
