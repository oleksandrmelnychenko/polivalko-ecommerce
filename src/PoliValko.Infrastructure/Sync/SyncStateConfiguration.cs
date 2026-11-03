using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Sync;

internal sealed class SyncStateConfiguration : IEntityTypeConfiguration<SyncState>
{
    public void Configure(EntityTypeBuilder<SyncState> builder)
    {
        builder.ToTable("sync_states", Schemas.Integration);
        builder.HasKey(s => s.Job);
        builder.Property(s => s.Job).HasMaxLength(100);
        builder.Property(s => s.LastError).HasMaxLength(2000);
    }
}
