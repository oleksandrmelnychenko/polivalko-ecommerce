namespace PoliValko.Delivery.Domain;

internal static class DeliveryLimits
{
    public const int RefLength = 50;
    public const int SettlementNameLength = 150;
    public const int AreaLength = 100;
    public const int WarehouseNameLength = 200;
    public const int WarehouseAddressLength = 300;
    public const int WarehouseSearchLength = WarehouseNameLength + WarehouseAddressLength + 1;

    public const int PickupCodeLength = 50;
    public const int PickupNameLength = 100;
    public const int PickupAddressLength = 300;
    public const int PickupScheduleLength = 200;
    public const int PickupInstructionsLength = 1000;
    public const int PickupMapUrlLength = 500;
}
