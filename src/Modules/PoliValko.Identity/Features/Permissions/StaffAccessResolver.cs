using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Features.Permissions;

internal sealed class StaffAccessEpoch
{
    private long _value;

    public long Value => Interlocked.Read(ref _value);

    public void Bump() => Interlocked.Increment(ref _value);
}

internal sealed class StaffAccessResolver(
    PoliValkoDbContext db,
    IMemoryCache cache,
    StaffAccessEpoch epoch,
    TimeProvider time)
    : IStaffAccessResolver
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromSeconds(30);

    public Task<StaffAccess?> GetAsync(string userId, CancellationToken ct = default) =>
        cache.GetOrCreateAsync($"staff-access:{epoch.Value}:{userId}", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = Lifetime;
            return LoadAsync(userId, ct);
        });

    public void Invalidate() => epoch.Bump();

    private async Task<StaffAccess?> LoadAsync(string userId, CancellationToken ct)
    {
        var now = time.GetUtcNow();
        var role = await (
                from user in db.Users
                where user.Id == userId && (user.LockoutEnd == null || user.LockoutEnd <= now)
                join link in db.UserRoles on user.Id equals link.UserId
                join r in db.Roles on link.RoleId equals r.Id
                orderby r.IsSuperuser descending
                select new { r.Id, r.DisplayName, r.IsSuperuser })
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);
        if (role is null)
        {
            return null;
        }

        IEnumerable<string> keys = role.IsSuperuser
            ? PermissionCatalog.AllKeys
            : await db.RolePermissions.AsNoTracking().Where(p => p.RoleId == role.Id).Select(p => p.Key).ToListAsync(ct);
        return new StaffAccess(role.Id, role.DisplayName, role.IsSuperuser, keys.Where(PermissionCatalog.Contains).ToHashSet(StringComparer.Ordinal));
    }
}
