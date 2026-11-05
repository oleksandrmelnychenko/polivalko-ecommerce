using Microsoft.AspNetCore.Identity;

namespace PoliValko.Infrastructure.Security;

public sealed class StaffRole : IdentityRole
{
    public StaffRole()
    {
    }

    public StaffRole(string name, string displayName)
        : base(name)
    {
        DisplayName = displayName;
    }

    public string DisplayName { get; set; } = string.Empty;

    public string? Description { get; set; }

    public bool IsSystem { get; set; }

    public bool IsSuperuser { get; set; }

    public long PermissionsVersion { get; set; }

    public DateTimeOffset? UpdatedAt { get; set; }

    public string? UpdatedBy { get; set; }

    public List<StaffRolePermission> Permissions { get; set; } = [];
}
