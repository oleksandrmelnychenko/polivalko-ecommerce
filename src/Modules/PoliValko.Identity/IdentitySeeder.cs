using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity;

/// <summary>
/// Працівники для локальної розробки й тестів із секції <c>Seed:Users</c>. Наявних користувачів
/// не змінює. На production облікові записи створює адміністратор окремо.
/// </summary>
public static class IdentitySeeder
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
        var roles = provider.GetRequiredService<RoleManager<IdentityRole>>();
        var users = provider.GetRequiredService<UserManager<StaffUser>>();
        var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger(typeof(IdentitySeeder));

        foreach (var role in StaffRoles.All)
        {
            if (!await roles.RoleExistsAsync(role))
            {
                Ensure(await roles.CreateAsync(new IdentityRole(role)), $"роль {role}");
            }
        }

        var seed = provider.GetRequiredService<IConfiguration>().GetSection("Seed:Users").Get<List<SeedUser>>() ?? [];
        foreach (var entry in seed)
        {
            ct.ThrowIfCancellationRequested();

            // Порожній запис — перший адміністратор не заданий у змінних середовища; це не помилка.
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
            // Слабкий пароль першого адміністратора не повинен зупиняти API: помилка видна в журналі.
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

    private static void Ensure(IdentityResult result, string what)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"Не вдалося створити {what}: {string.Join("; ", result.Errors.Select(e => e.Description))}");
        }
    }
}
