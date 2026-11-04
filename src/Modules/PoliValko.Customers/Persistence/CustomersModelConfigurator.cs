using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Customers.Persistence;

internal sealed class CustomersModelConfigurator : IModelConfigurator
{
    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Customer>(ConfigureCustomer);
        modelBuilder.Entity<CustomerAddress>(ConfigureAddress);
        modelBuilder.Entity<CustomerToken>(ConfigureToken);
    }

    private static void ConfigureCustomer(EntityTypeBuilder<Customer> builder)
    {
        builder.ToTable("customers", Schemas.Customers);
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Email).HasMaxLength(200);
        builder.Property(c => c.NormalizedEmail).HasMaxLength(200);
        builder.Property(c => c.PasswordHash).HasMaxLength(200);
        builder.Property(c => c.Name).HasMaxLength(100);
        builder.Property(c => c.Phone).HasMaxLength(20);
        builder.Property(c => c.SecurityStamp).HasMaxLength(64);
        builder.HasIndex(c => c.NormalizedEmail).IsUnique();
        builder.HasMany<CustomerAddress>().WithOne().HasForeignKey(a => a.CustomerId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany<CustomerToken>().WithOne().HasForeignKey(t => t.CustomerId).OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureAddress(EntityTypeBuilder<CustomerAddress> builder)
    {
        builder.ToTable("customer_addresses", Schemas.Customers);
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Label).HasMaxLength(50);
        builder.Property(a => a.DeliveryMethod).HasMaxLength(30);
        builder.Property(a => a.SettlementRef).HasMaxLength(100);
        builder.Property(a => a.SettlementName).HasMaxLength(200);
        builder.Property(a => a.WarehouseRef).HasMaxLength(100);
        builder.Property(a => a.WarehouseName).HasMaxLength(300);
        builder.Property(a => a.Street).HasMaxLength(150);
        builder.Property(a => a.House).HasMaxLength(20);
        builder.Property(a => a.Apartment).HasMaxLength(20);
        builder.HasIndex(a => a.CustomerId);
    }

    private static void ConfigureToken(EntityTypeBuilder<CustomerToken> builder)
    {
        builder.ToTable("customer_tokens", Schemas.Customers);
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Id).ValueGeneratedNever();
        builder.Property(t => t.Purpose).HasConversion<string>().HasMaxLength(30);
        builder.Property(t => t.TokenHash).HasMaxLength(64);
        builder.HasIndex(t => t.TokenHash).IsUnique();
        builder.HasIndex(t => new { t.CustomerId, t.Purpose });
    }
}
