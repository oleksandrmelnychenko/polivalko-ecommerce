using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Security;

/// <summary>Обліковий запис працівника (адміністратор або менеджер). Покупці облікових записів не мають.</summary>
public sealed class StaffUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
}

public static class StaffRoles
{
    public const string Admin = "Admin";
    public const string Manager = "Manager";

    public static readonly string[] All = [Admin, Manager];
}

public static class StaffClaims
{
    public const string DisplayName = "display_name";

    /// <summary>Ім'я працівника для журналу змін (історія статусів, аудит).</summary>
    public static string StaffName(this System.Security.Claims.ClaimsPrincipal user) =>
        user.FindFirst(DisplayName)?.Value is { Length: > 0 } name ? name : user.Identity?.Name ?? "Працівник";
}

public static class StaffPolicies
{
    /// <summary>Адміністратор або менеджер: замовлення, звернення.</summary>
    public const string Staff = "staff";

    /// <summary>Лише адміністратор: доступи й налаштування.</summary>
    public const string Admin = "admin";
}

internal static class IdentityModel
{
    public static void MoveToSchema(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<StaffUser>(b =>
        {
            b.ToTable("users", Schemas.Identity);
            b.Property(u => u.DisplayName).HasMaxLength(100);
        });
        modelBuilder.Entity<IdentityRole>().ToTable("roles", Schemas.Identity);
        modelBuilder.Entity<IdentityUserRole<string>>().ToTable("user_roles", Schemas.Identity);
        modelBuilder.Entity<IdentityUserClaim<string>>().ToTable("user_claims", Schemas.Identity);
        modelBuilder.Entity<IdentityUserLogin<string>>().ToTable("user_logins", Schemas.Identity);
        modelBuilder.Entity<IdentityUserToken<string>>().ToTable("user_tokens", Schemas.Identity);
        modelBuilder.Entity<IdentityRoleClaim<string>>().ToTable("role_claims", Schemas.Identity);
        modelBuilder.Entity<DataProtectionKey>().ToTable("data_protection_keys", Schemas.Identity);
    }
}
