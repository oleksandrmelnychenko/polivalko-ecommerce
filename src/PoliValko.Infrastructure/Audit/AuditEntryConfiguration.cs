using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Audit;

internal sealed class AuditEntryConfiguration : IEntityTypeConfiguration<AuditEntry>
{
    public void Configure(EntityTypeBuilder<AuditEntry> builder)
    {
        builder.ToTable("audit_log", Schemas.Integration);
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();
        builder.Property(e => e.Actor).HasMaxLength(200);
        builder.Property(e => e.Action).HasMaxLength(100);
        builder.Property(e => e.EntityType).HasMaxLength(100);
        builder.Property(e => e.EntityId).HasMaxLength(200);
        builder.Property(e => e.Details).HasColumnType("jsonb");
        builder.HasIndex(e => e.At);
        builder.HasIndex(e => new { e.EntityType, e.EntityId });
    }
}
