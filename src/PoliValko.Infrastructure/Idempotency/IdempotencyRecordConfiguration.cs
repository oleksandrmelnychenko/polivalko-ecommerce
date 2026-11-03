using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Idempotency;

internal sealed class IdempotencyRecordConfiguration : IEntityTypeConfiguration<IdempotencyRecord>
{
    public void Configure(EntityTypeBuilder<IdempotencyRecord> builder)
    {
        builder.ToTable("idempotency_keys", Schemas.Integration);
        builder.HasKey(r => new { r.Scope, r.Key });
        builder.Property(r => r.Scope).HasMaxLength(200);
        builder.Property(r => r.Key).HasMaxLength(100);
        builder.Property(r => r.RequestHash).HasMaxLength(64);
        builder.Property(r => r.ResponseBody).HasColumnType("jsonb");
        builder.Property(r => r.ResponseLocation).HasMaxLength(500);
        builder.HasIndex(r => r.CreatedAt);
    }
}
