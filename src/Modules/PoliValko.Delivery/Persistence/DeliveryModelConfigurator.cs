using Microsoft.EntityFrameworkCore;
using PoliValko.Delivery.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Delivery.Persistence;

internal sealed class DeliveryModelConfigurator : IModelConfigurator
{
    public const string SettlementsTable = "np_settlements";
    public const string WarehousesTable = "np_warehouses";
    public const string PickupPointsTable = "pickup_points";

    public const string BuchaStoreCode = "bucha-store";

    public void Configure(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<NpSettlement>(builder =>
        {
            builder.ToTable(SettlementsTable, Schemas.Delivery);
            builder.HasKey(s => s.Ref);
            builder.Property(s => s.Ref).HasMaxLength(DeliveryLimits.RefLength);
            builder.Property(s => s.Name).HasMaxLength(DeliveryLimits.SettlementNameLength);
            builder.Property(s => s.Area).HasMaxLength(DeliveryLimits.AreaLength);
            builder.Property(s => s.SearchName).HasMaxLength(DeliveryLimits.SettlementNameLength);

            builder.HasIndex(s => s.SearchName).HasOperators("text_pattern_ops");
        });

        modelBuilder.Entity<NpWarehouse>(builder =>
        {
            builder.ToTable(WarehousesTable, Schemas.Delivery);
            builder.HasKey(w => w.Ref);
            builder.Property(w => w.Ref).HasMaxLength(DeliveryLimits.RefLength);
            builder.Property(w => w.SettlementRef).HasMaxLength(DeliveryLimits.RefLength);
            builder.Property(w => w.Name).HasMaxLength(DeliveryLimits.WarehouseNameLength);
            builder.Property(w => w.Address).HasMaxLength(DeliveryLimits.WarehouseAddressLength);
            builder.Property(w => w.SearchText).HasMaxLength(DeliveryLimits.WarehouseSearchLength);
            builder.Property(w => w.Type).HasConversion<string>().HasMaxLength(20);
            builder.HasIndex(w => new { w.SettlementRef, w.IsActive });
        });

        modelBuilder.Entity<PickupLocation>(builder =>
        {
            builder.ToTable(PickupPointsTable, Schemas.Delivery);
            builder.HasKey(p => p.Code);
            builder.Property(p => p.Code).HasMaxLength(DeliveryLimits.PickupCodeLength);
            builder.Property(p => p.Name).HasMaxLength(DeliveryLimits.PickupNameLength);
            builder.Property(p => p.Address).HasMaxLength(DeliveryLimits.PickupAddressLength);
            builder.Property(p => p.Schedule).HasMaxLength(DeliveryLimits.PickupScheduleLength);
            builder.Property(p => p.Instructions).HasMaxLength(DeliveryLimits.PickupInstructionsLength);
            builder.Property(p => p.MapUrl).HasMaxLength(DeliveryLimits.PickupMapUrlLength);
            builder.HasData(new PickupLocation
            {
                Code = BuchaStoreCode,
                Name = "Магазин Poli Valko у Бучі",
                Address = "м. Буча (точну адресу надає замовник)",
                Schedule = "Пн–Нд, 9:00–19:00 (уточнюється)",
                Instructions = "Дочекайтеся повідомлення, що замовлення готове, і назвіть номер замовлення на касі.",
                MapUrl = null,
                IsActive = true,
            });
        });
    }
}
