using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Navkolo.Features.SalesArchive;

namespace PoliValko.Navkolo.Features.WorkForms;

internal sealed class DnTradeWorkForm
{
    public Guid Id { get; init; }
    public int Version { get; set; }
    public required string Section { get; set; }
    public required string Type { get; set; }
    public required string Status { get; set; }
    public required string Title { get; set; }
    public DateOnly? DocumentDate { get; set; }
    public Guid? SourceRecordId { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; set; }
    public required string Data { get; set; }
}

internal sealed class DnTradeWorkFormModel : IModelConfigurator
{
    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<DnTradeWorkForm>(form =>
        {
            form.ToTable("dntrade_work_forms", Schemas.Integration);
            form.HasKey(x => x.Id);
            form.Property(x => x.Id).ValueGeneratedNever();
            form.Property(x => x.Version).IsConcurrencyToken();
            form.Property(x => x.Section).HasMaxLength(16);
            form.Property(x => x.Type).HasMaxLength(24);
            form.Property(x => x.Status).HasMaxLength(12);
            form.Property(x => x.Title).HasMaxLength(200);
            form.Property(x => x.Data).HasColumnType("jsonb");
            form.HasIndex(x => new { x.UpdatedAt, x.Id });
            form.HasIndex(x => new { x.Section, x.Status, x.UpdatedAt, x.Id });
            form.HasIndex(x => x.SourceRecordId);
            form.HasOne<DnTradeArchiveRecord>().WithMany().HasForeignKey(x => x.SourceRecordId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
