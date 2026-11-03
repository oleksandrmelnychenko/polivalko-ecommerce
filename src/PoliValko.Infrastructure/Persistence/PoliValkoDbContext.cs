using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Infrastructure.Persistence;

public sealed class PoliValkoDbContext(
    DbContextOptions<PoliValkoDbContext> options,
    IEnumerable<IModelConfigurator> configurators)
    : IdentityDbContext<StaffUser, IdentityRole, string>(options), IDataProtectionKeyContext
{
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<IdempotencyRecord> IdempotencyRecords => Set<IdempotencyRecord>();

    public DbSet<DataProtectionKey> DataProtectionKeys => Set<DataProtectionKey>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        IdentityModel.MoveToSchema(modelBuilder);

        modelBuilder.HasPostgresExtension("pg_trgm");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PoliValkoDbContext).Assembly);

        foreach (var configurator in configurators)
        {
            configurator.Configure(modelBuilder);
        }
    }
}
