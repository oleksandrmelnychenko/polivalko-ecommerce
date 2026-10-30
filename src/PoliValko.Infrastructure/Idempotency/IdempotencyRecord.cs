using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Infrastructure.Idempotency;

public sealed class IdempotencyRecord
{
    /// <summary>Метод і шаблон маршруту, напр. "POST /api/v1/service-requests".</summary>
    public required string Scope { get; init; }

    public required string Key { get; init; }

    public required string RequestHash { get; init; }

    public DateTimeOffset CreatedAt { get; init; }

    /// <summary>null — запит ще виконується.</summary>
    public DateTimeOffset? CompletedAt { get; set; }

    public int? StatusCode { get; set; }

    public string? ResponseBody { get; set; }

    public string? ResponseLocation { get; set; }
}

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
