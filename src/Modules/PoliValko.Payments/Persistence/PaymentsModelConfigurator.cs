using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Payments.Domain;

namespace PoliValko.Payments.Persistence;

internal sealed class PaymentsModelConfigurator : IModelConfigurator
{
    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Payment>(builder =>
        {
            builder.ToTable("payments", Schemas.Payments);
            builder.HasKey(p => p.Id);
            builder.Property(p => p.Id).ValueGeneratedNever();
            builder.Property(p => p.OrderNumber).HasMaxLength(20);
            builder.Property(p => p.Provider).HasMaxLength(30);
            builder.Property(p => p.ProviderPaymentId).HasMaxLength(200);
            builder.Property(p => p.Amount).HasPrecision(12, 2);
            builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
            builder.Property(p => p.PageUrl).HasMaxLength(1000);
            builder.Property(p => p.FailureReason).HasMaxLength(500);
            builder.Ignore(p => p.IsActive);
            builder.HasIndex(p => p.OrderId);
            builder.HasIndex(p => new { p.Provider, p.ProviderPaymentId }).IsUnique();
            builder.HasIndex(p => new { p.Status, p.CreatedAt });
        });

        modelBuilder.Entity<PaymentEvent>(builder =>
        {
            builder.ToTable("payment_events", Schemas.Payments);
            builder.HasKey(e => e.Id);
            builder.Property(e => e.Id).ValueGeneratedNever();
            builder.Property(e => e.Provider).HasMaxLength(30);
            builder.Property(e => e.EventKey).HasMaxLength(300);
            builder.Property(e => e.Source).HasMaxLength(20);
            builder.Property(e => e.State).HasMaxLength(30);
            builder.Property(e => e.Payload).HasColumnType("jsonb");
            builder.HasIndex(e => new { e.Provider, e.EventKey }).IsUnique();
            builder.HasIndex(e => e.PaymentId);
        });

        modelBuilder.Entity<SandboxInvoice>(builder =>
        {
            builder.ToTable("sandbox_invoices", Schemas.Payments);
            builder.HasKey(i => i.Id);
            builder.Property(i => i.Id).HasMaxLength(100);
            builder.Property(i => i.OrderNumber).HasMaxLength(20);
            builder.Property(i => i.Amount).HasPrecision(12, 2);
            builder.Property(i => i.RefundedAmount).HasPrecision(12, 2);
            builder.Property(i => i.Status).HasMaxLength(20);
            builder.Property(i => i.RedirectUrl).HasMaxLength(1000);
        });
    }
}
