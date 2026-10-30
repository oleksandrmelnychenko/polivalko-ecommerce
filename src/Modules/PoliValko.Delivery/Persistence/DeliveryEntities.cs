namespace PoliValko.Delivery.Persistence;

/// <summary>
/// Населений пункт з локальної копії довідника Нової пошти (<c>Address.getCities</c>).
/// Ключ — Ref Нової пошти. Пункт, якого немає в черговій синхронізації, стає неактивним, а не видаляється.
/// </summary>
internal sealed class NpSettlement
{
    public required string Ref { get; init; }

    public required string Name { get; set; }

    /// <summary>Область для підказки, напр. «Київська обл.».</summary>
    public required string Area { get; set; }

    /// <summary>Назва в нижньому регістрі з уніфікованими апострофами — для пошуку за початком назви.</summary>
    public required string SearchName { get; set; }

    /// <summary>Кількість активних відділень і поштоматів; перераховується після кожної синхронізації.</summary>
    public int ActiveWarehouseCount { get; set; }

    public bool IsActive { get; set; }

    /// <summary>Мітка запуску синхронізації, у відповіді якого пункт був востаннє.</summary>
    public DateTimeOffset LastSeenAt { get; set; }
}

/// <summary>
/// Відділення або поштомат з локальної копії довідника (<c>AddressGeneral.getWarehouses</c>).
/// Старі замовлення посилаються на Ref, тому зниклі відділення лише деактивуються.
/// </summary>
internal sealed class NpWarehouse
{
    public required string Ref { get; init; }

    /// <summary>Ref населеного пункту з <c>Address.getCities</c> (поле <c>CityRef</c> відділення).</summary>
    public required string SettlementRef { get; set; }

    public int Number { get; set; }

    public required string Name { get; set; }

    public required string Address { get; set; }

    public WarehouseType Type { get; set; }

    /// <summary>Назва й адреса в нижньому регістрі — для пошуку відділення в межах міста.</summary>
    public required string SearchText { get; set; }

    public bool IsActive { get; set; }

    public DateTimeOffset LastSeenAt { get; set; }
}

/// <summary>Точка самовивозу, яку веде адміністратор: адреса, графік роботи та інструкція покупцю.</summary>
internal sealed class PickupLocation
{
    public required string Code { get; init; }

    public required string Name { get; set; }

    public required string Address { get; set; }

    public required string Schedule { get; set; }

    public required string Instructions { get; set; }

    /// <summary>Посилання на карту (Google Maps тощо), необов'язкове.</summary>
    public string? MapUrl { get; set; }

    public bool IsActive { get; set; }
}

/// <summary>Обмеження довжини полів довідника й точок самовивозу (спільні для БД і валідації).</summary>
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
