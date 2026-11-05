using System.Security.Claims;

namespace PoliValko.Infrastructure.Security.Permissions;

public sealed record StaffAccess(string RoleId, string RoleName, bool IsSuperuser, IReadOnlySet<string> PermissionKeys)
{
    public bool Has(string key) => PermissionKeys.Contains(key);

    public bool HasAny(IEnumerable<string> keys) => keys.Any(PermissionKeys.Contains);
}

public interface IStaffAccessResolver
{
    Task<StaffAccess?> GetAsync(string userId, CancellationToken ct = default);

    void Invalidate();
}

public static class StaffAccessExtensions
{
    private const string ItemKey = "pv.staff-access";

    public static async Task<StaffAccess?> GetStaffAccessAsync(this IStaffAccessResolver resolver, ClaimsPrincipal user, IDictionary<object, object?>? items, CancellationToken ct)
    {
        if (items is not null && items.TryGetValue(ItemKey, out var cached))
        {
            return cached as StaffAccess;
        }

        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        var access = userId is null ? null : await resolver.GetAsync(userId, ct);
        if (items is not null)
        {
            items[ItemKey] = access;
        }

        return access;
    }
}
