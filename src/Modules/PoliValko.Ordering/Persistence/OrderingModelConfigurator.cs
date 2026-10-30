using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Ordering.Domain;

namespace PoliValko.Ordering.Persistence;

internal sealed class OrderingModelConfigurator : IModelConfigurator
{
    public const string NumberSequence = "order_number_seq";

    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.HasSequence<long>(NumberSequence, Schemas.Ordering).StartsAt(100001);

        modelBuilder.Entity<Order>(builder =>
        {
            builder.ToTable("orders", Schemas.Ordering);
            builder.HasKey(o => o.Id);
            builder.Property(o => o.Id).ValueGeneratedNever();
            builder.Property(o => o.Number).HasMaxLength(20);
            builder.Property(o => o.AccessTokenHash).HasMaxLength(64);
            builder.Property(o => o.IdempotencyKey).HasMaxLength(100);
            builder.Property(o => o.Status).HasConversion<string>().HasMaxLength(30);
            builder.Property(o => o.PaymentMethod).HasConversion<string>().HasMaxLength(30);
            builder.Property(o => o.PaymentStatus).HasConversion<string>().HasMaxLength(30);
            builder.Property(o => o.DeliveryMethod).HasConversion<string>().HasMaxLength(30);
            builder.Property(o => o.CustomerName).HasMaxLength(100);
            builder.Property(o => o.CustomerPhone).HasMaxLength(20);
            builder.Property(o => o.CustomerEmail).HasMaxLength(200);
            builder.Property(o => o.SettlementRef).HasMaxLength(100);
            builder.Property(o => o.SettlementName).HasMaxLength(200);
            builder.Property(o => o.WarehouseRef).HasMaxLength(100);
            builder.Property(o => o.WarehouseName).HasMaxLength(300);
            builder.Property(o => o.PickupAddress).HasMaxLength(500);
            builder.Property(o => o.DeliveryAddress).HasMaxLength(300);
            builder.Property(o => o.SellerName).HasMaxLength(300);
            builder.Property(o => o.SellerTaxId).HasMaxLength(20);
            builder.Property(o => o.RefundedAmount).HasPrecision(12, 2);
            builder.Property(o => o.NavkoloOrderRef).HasMaxLength(100);
            builder.Property(o => o.Comment).HasMaxLength(1000);
            builder.Property(o => o.Subtotal).HasPrecision(12, 2);
            builder.Property(o => o.Total).HasPrecision(12, 2);
            builder.Property(o => o.Version).IsRowVersion();
            builder.HasIndex(o => o.Number).IsUnique();
            builder.HasIndex(o => o.IdempotencyKey).IsUnique();
            builder.HasIndex(o => new { o.Status, o.CreatedAt });
            builder.HasIndex(o => o.CustomerPhone);
            builder.HasMany(o => o.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
            builder.HasMany(o => o.History).WithOne().HasForeignKey(h => h.OrderId).OnDelete(DeleteBehavior.Cascade);
            builder.HasMany(o => o.Refunds).WithOne().HasForeignKey(r => r.OrderId).OnDelete(DeleteBehavior.Cascade);
            builder.HasIndex(o => o.NavkoloExportedAt);
        });

        modelBuilder.Entity<OrderRefund>(builder =>
        {
            builder.ToTable("order_refunds", Schemas.Ordering);
            builder.HasKey(r => r.Id);
            builder.Property(r => r.Id).ValueGeneratedNever();
            builder.Property(r => r.Method).HasConversion<string>().HasMaxLength(20);
            builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);
            builder.Property(r => r.Amount).HasPrecision(12, 2);
            builder.Property(r => r.Reason).HasMaxLength(500);
            builder.Property(r => r.RequestedBy).HasMaxLength(200);
            builder.Property(r => r.ProviderRef).HasMaxLength(200);
            builder.Property(r => r.Error).HasMaxLength(1000);
            builder.HasMany(r => r.Lines).WithOne().HasForeignKey(l => l.RefundId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OrderRefundLine>(builder =>
        {
            builder.ToTable("order_refund_lines", Schemas.Ordering);
            builder.HasKey(l => l.Id);
            builder.Property(l => l.Id).ValueGeneratedNever();
            builder.Property(l => l.Amount).HasPrecision(12, 2);
            builder.HasOne<OrderItem>().WithMany().HasForeignKey(l => l.OrderItemId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderItem>(builder =>
        {
            builder.ToTable("order_items", Schemas.Ordering);
            builder.HasKey(i => i.Id);
            builder.Property(i => i.Id).ValueGeneratedNever();
            builder.Property(i => i.Sku).HasMaxLength(100);
            builder.Property(i => i.Name).HasMaxLength(500);
            builder.Property(i => i.Slug).HasMaxLength(300);
            builder.Property(i => i.ImageUrl).HasMaxLength(1000);
            builder.Property(i => i.UnitPrice).HasPrecision(12, 2);
            builder.Property(i => i.LineTotal).HasPrecision(12, 2);
        });

        modelBuilder.Entity<OrderStatusChange>(builder =>
        {
            builder.ToTable("order_status_changes", Schemas.Ordering);
            builder.HasKey(h => h.Id);
            builder.Property(h => h.Id).ValueGeneratedNever();
            builder.Property(h => h.From).HasConversion<string>().HasMaxLength(30);
            builder.Property(h => h.To).HasConversion<string>().HasMaxLength(30);
            builder.Property(h => h.By).HasMaxLength(200);
            builder.Property(h => h.Reason).HasMaxLength(500);
            builder.HasIndex(h => new { h.OrderId, h.At });
        });
    }
}
