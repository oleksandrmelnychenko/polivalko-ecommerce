using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Identity.Persistence;

internal static class IdentitySeeder
{
    private sealed class SeedUser
    {
        public string? Email { get; set; }

        public string? Password { get; set; }

        public string? DisplayName { get; set; }

        public string? Role { get; set; }
    }

    public static async Task SeedAsync(IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        var provider = scope.ServiceProvider;
        var roles = provider.GetRequiredService<RoleManager<StaffRole>>();
        var users = provider.GetRequiredService<UserManager<StaffUser>>();
        var db = provider.GetRequiredService<PoliValkoDbContext>();
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(IdentitySeeder));

        await EnsureSystemRoleAsync(roles, StaffRoles.Admin, "Адміністратор", "Усі права, зокрема працівники, ролі й налаштування. Не редагується.", superuser: true);
        var manager = await EnsureSystemRoleAsync(roles, StaffRoles.Manager, "Менеджер", "Замовлення, покупці, заявки й товари.", superuser: false);
        await ReconcileDefaultsAsync(db, manager, PermissionCatalog.ManagerDefaults, ct);

        var seed = provider.GetRequiredService<IConfiguration>().GetSection("Seed:Users").Get<List<SeedUser>>() ?? [];
        foreach (var entry in seed)
        {
            ct.ThrowIfCancellationRequested();

            if (string.IsNullOrWhiteSpace(entry.Email) && string.IsNullOrWhiteSpace(entry.Password))
            {
                continue;
            }

            if (string.IsNullOrWhiteSpace(entry.Email) || string.IsNullOrWhiteSpace(entry.Password)
                || !StaffRoles.All.Contains(entry.Role))
            {
                logger.LogWarning("Seed:Users: пропущено неповний запис");
                continue;
            }

            if (await users.FindByEmailAsync(entry.Email) is not null)
            {
                continue;
            }

            var user = new StaffUser
            {
                UserName = entry.Email,
                Email = entry.Email,
                EmailConfirmed = true,
                DisplayName = entry.DisplayName ?? entry.Email,
            };
            var created = await users.CreateAsync(user, entry.Password);
            if (!created.Succeeded)
            {
                logger.LogError(
                    "Seed:Users: працівника {Email} не створено: {Errors}",
                    entry.Email,
                    string.Join("; ", created.Errors.Select(e => e.Description)));
                continue;
            }

            Ensure(await users.AddToRoleAsync(user, entry.Role!), $"роль для {entry.Email}");
            logger.LogInformation("Створено працівника {Email} з роллю {Role}", entry.Email, entry.Role);
        }
    }

    private static async Task<StaffRole> EnsureSystemRoleAsync(RoleManager<StaffRole> roles, string name, string displayName, string description, bool superuser)
    {
        var role = await roles.FindByNameAsync(name);
        if (role is null)
        {
            role = new StaffRole(name, displayName) { Description = description, IsSystem = true, IsSuperuser = superuser };
            Ensure(await roles.CreateAsync(role), $"роль {name}");
            return role;
        }

        if (role.IsSystem && role.IsSuperuser == superuser && !string.IsNullOrEmpty(role.DisplayName))
        {
            return role;
        }

        role.IsSystem = true;
        role.IsSuperuser = superuser;
        if (string.IsNullOrEmpty(role.DisplayName))
        {
            role.DisplayName = displayName;
            role.Description = description;
        }

        Ensure(await roles.UpdateAsync(role), $"роль {name}");
        return role;
    }

    private static async Task ReconcileDefaultsAsync(PoliValkoDbContext db, StaffRole role, IReadOnlyList<string> defaults, CancellationToken ct)
    {
        if (role.PermissionsVersion > 0)
        {
            return;
        }

        var current = await db.RolePermissions.Where(p => p.RoleId == role.Id).ToListAsync(ct);
        var wanted = defaults.ToHashSet(StringComparer.Ordinal);
        db.RolePermissions.RemoveRange(current.Where(p => !wanted.Contains(p.Key)));
        var have = current.Select(p => p.Key).ToHashSet(StringComparer.Ordinal);
        db.RolePermissions.AddRange(defaults.Where(key => !have.Contains(key)).Select(key => new StaffRolePermission { RoleId = role.Id, Key = key }));
        await db.SaveChangesAsync(ct);
    }

    private static void Ensure(IdentityResult result, string what)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"Не вдалося створити {what}: {string.Join("; ", result.Errors.Select(e => e.Description))}");
        }
    }
}
