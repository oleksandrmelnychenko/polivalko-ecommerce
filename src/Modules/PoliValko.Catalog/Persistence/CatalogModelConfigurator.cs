using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Persistence;

internal sealed class CatalogModelConfigurator : IModelConfigurator
{
    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Category>(ConfigureCategory);
        modelBuilder.Entity<Product>(ConfigureProduct);
        modelBuilder.Entity<ProductPrice>(ConfigurePrice);
        modelBuilder.Entity<ProductStock>(ConfigureStock);
        modelBuilder.Entity<ProductImage>(ConfigureImage);
        modelBuilder.Entity<ProductAttribute>(ConfigureAttribute);
        modelBuilder.Entity<HomeCollection>(ConfigureCollection);
        modelBuilder.Entity<UrlRedirect>(ConfigureRedirect);
    }

    private static void ConfigureAttribute(EntityTypeBuilder<ProductAttribute> builder)
    {
        builder.ToTable("product_attributes", Schemas.Catalog);
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Name).HasMaxLength(100);
        builder.Property(a => a.Value).HasMaxLength(300);
        builder.HasIndex(a => new { a.ProductId, a.SortOrder });
        builder.HasIndex(a => new { a.Name, a.Value });
    }

    private static void ConfigureCollection(EntityTypeBuilder<HomeCollection> builder)
    {
        builder.ToTable("home_collections", Schemas.Catalog);
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Code).HasMaxLength(50);
        builder.Property(c => c.Title).HasMaxLength(200);
        builder.HasIndex(c => c.Code).IsUnique();
    }

    private static void ConfigureRedirect(EntityTypeBuilder<UrlRedirect> builder)
    {
        builder.ToTable("redirects", Schemas.Catalog);
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.FromPath).HasMaxLength(500);
        builder.Property(r => r.ToPath).HasMaxLength(500);
        builder.HasIndex(r => r.FromPath).IsUnique();
    }

    private static void ConfigureImage(EntityTypeBuilder<ProductImage> builder)
    {
        builder.ToTable("product_images", Schemas.Catalog);
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id).ValueGeneratedNever();
        builder.Property(i => i.Url).HasMaxLength(1000);
        builder.Property(i => i.Alt).HasMaxLength(300);
        builder.Property(i => i.Credit).HasMaxLength(500);
        builder.HasIndex(i => new { i.ProductId, i.SortOrder });
    }

    private static void ConfigureCategory(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("categories", Schemas.Catalog);
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Slug).HasMaxLength(200);
        builder.Property(c => c.Name).HasMaxLength(200);
        builder.Property(c => c.NavkoloRef).HasMaxLength(100);
        builder.Property(c => c.SeoTitle).HasMaxLength(200);
        builder.Property(c => c.SeoDescription).HasMaxLength(500);
        builder.HasIndex(c => c.NavkoloRef);
        builder.HasIndex(c => c.Slug).IsUnique();
        builder.HasOne<Category>().WithMany().HasForeignKey(c => c.ParentId).OnDelete(DeleteBehavior.Restrict);
        builder.HasData(TopLevelCategories.All);
    }

    private static void ConfigureProduct(EntityTypeBuilder<Product> builder)
    {
        builder.ToTable("products", Schemas.Catalog);
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.NavkoloId).HasMaxLength(100);
        builder.Property(p => p.Sku).HasMaxLength(100);
        builder.Property(p => p.Name).HasMaxLength(500);
        builder.Property(p => p.DisplayName).HasMaxLength(500);
        builder.Property(p => p.Slug).HasMaxLength(300);
        builder.Property(p => p.Brand).HasMaxLength(200);
        builder.Property(p => p.NavkoloGroupRef).HasMaxLength(100);
        builder.Property(p => p.VariantGroup).HasMaxLength(100);
        builder.Property(p => p.VariantLabel).HasMaxLength(100);
        builder.Property(p => p.SeoTitle).HasMaxLength(200);
        builder.Property(p => p.SeoDescription).HasMaxLength(500);
        builder.HasIndex(p => p.VariantGroup);
        builder.HasIndex(p => p.NavkoloId).IsUnique();
        builder.HasIndex(p => p.Slug).IsUnique();
        builder.HasIndex(p => p.Sku);
        builder.HasIndex(p => p.CategoryId);

        // Пошук за частиною назви (ILIKE '%…%') з індексом pg_trgm.
        builder.HasIndex(p => p.Name).HasMethod("gin").HasOperators("gin_trgm_ops");

        builder.HasOne<Category>().WithMany().HasForeignKey(p => p.CategoryId).OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(p => p.Price).WithOne().HasForeignKey<ProductPrice>(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(p => p.Stock).WithOne().HasForeignKey<ProductStock>(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(p => p.Images).WithOne().HasForeignKey(i => i.ProductId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(p => p.Attributes).WithOne().HasForeignKey(a => a.ProductId).OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(p => p.Price).IsRequired();
        builder.Navigation(p => p.Stock).IsRequired();
    }

    private static void ConfigurePrice(EntityTypeBuilder<ProductPrice> builder)
    {
        builder.ToTable("product_prices", Schemas.Catalog);
        builder.HasKey(x => x.ProductId);
        builder.Property(x => x.Amount).HasPrecision(12, 2);
        builder.Property(x => x.OldAmount).HasPrecision(12, 2);
        builder.HasIndex(x => x.Amount);
    }

    private static void ConfigureStock(EntityTypeBuilder<ProductStock> builder)
    {
        builder.ToTable("product_stock", Schemas.Catalog);
        builder.HasKey(x => x.ProductId);
        builder.Property(x => x.Quantity).HasPrecision(12, 3);
    }
}
