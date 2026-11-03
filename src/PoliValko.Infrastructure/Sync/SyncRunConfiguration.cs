using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Sync;

internal sealed class SyncRunConfiguration : IEntityTypeConfiguration<SyncRun>
{
    public void Configure(EntityTypeBuilder<SyncRun> builder)
    {
        builder.ToTable("sync_runs", Schemas.Integration);
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Job).HasMaxLength(100);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(30);
        builder.Property(r => r.StartedBy).HasMaxLength(200);
        builder.Property(r => r.Summary).HasMaxLength(1000);
        builder.Property(r => r.Errors).HasColumnType("jsonb");
        builder.HasIndex(r => new { r.Job, r.StartedAt });
    }
}
