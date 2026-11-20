using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Navkolo.Features.SalesArchive;

internal sealed class DnTradeArchiveRecord
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string SourceAccount { get; init; }
    public required string EntityType { get; init; }
    public required string SourceId { get; init; }
    public string? SourceDate { get; init; }
    public DateOnly? SourceDay { get; init; }
    public string? DocumentType { get; init; }
    public string? OrganizationId { get; init; }
    public string[] StoreIds { get; init; } = [];
    public string? Status { get; init; }
    public string? Currency { get; init; }
    public decimal? Total { get; init; }
    public string? ParentSourceId { get; init; }
    public DateTimeOffset ImportedAt { get; init; }
    public required string Payload { get; init; }
    public required string Fingerprint { get; init; }
}

internal sealed class DnTradeArchiveModel : IModelConfigurator
{
    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DnTradeArchiveRecord>(record =>
        {
            record.ToTable("dntrade_archive_records", Schemas.Integration);
            record.HasKey(x => x.Id);
            record.HasIndex(x => new { x.SourceAccount, x.SourceId, x.EntityType }).IsUnique();
            record.HasIndex(x => new { x.SourceDay, x.Id });
            record.HasIndex(x => x.StoreIds).HasMethod("gin");
            record.Property(x => x.SourceAccount).HasMaxLength(64);
            record.Property(x => x.EntityType).HasMaxLength(32);
            record.Property(x => x.SourceId).HasMaxLength(200);
            record.Property(x => x.SourceDate).HasMaxLength(48);
            record.Property(x => x.DocumentType).HasMaxLength(96);
            record.Property(x => x.OrganizationId).HasMaxLength(200);
            record.Property(x => x.Status).HasMaxLength(96);
            record.Property(x => x.Currency).HasMaxLength(16);
            record.Property(x => x.ParentSourceId).HasMaxLength(200);
            // Keep the archived JSON's original whitespace, property order and escaping for download.
            record.Property(x => x.Payload).HasColumnType("text");
            record.Property(x => x.Fingerprint).HasMaxLength(64);
        });
    }
}
