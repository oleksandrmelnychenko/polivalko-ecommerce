using Microsoft.EntityFrameworkCore;
using PoliValko.Fiscal.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Fiscal.Persistence;

internal sealed class FiscalModelConfigurator : IModelConfigurator
{
    public void Configure(ModelBuilder modelBuilder) =>
        modelBuilder.Entity<Receipt>(builder =>
        {
            builder.ToTable("receipts", Schemas.Fiscal);
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).ValueGeneratedNever();
            builder.Property(r => r.OrderNumber).HasMaxLength(20);
            builder.Property(r => r.Kind).HasConversion<string>().HasMaxLength(10);
            builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(10);
            builder.Property(r => r.Amount).HasPrecision(12, 2);
            builder.Property(r => r.PaymentType).HasMaxLength(20);
            builder.Property(r => r.Provider).HasMaxLength(30);
            builder.Property(r => r.ProviderReceiptId).HasMaxLength(100);
            builder.Property(r => r.FiscalCode).HasMaxLength(100);
            builder.Property(r => r.Url).HasMaxLength(500);
            builder.Property(r => r.Error).HasMaxLength(1000);
            builder.HasIndex(r => new { r.OrderId, r.Kind, r.RefundId }).IsUnique().AreNullsDistinct(false);
        });
}
