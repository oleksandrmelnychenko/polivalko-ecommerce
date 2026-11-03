using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Security;

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
