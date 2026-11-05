namespace PoliValko.Delivery.Contracts;

public sealed record DeliveryAvailability(
    bool NovaPoshta,
    bool CashOnDelivery,
    bool Courier,
    string? CourierArea,
    string? CourierPriceNote,
    PickupPoint? Pickup);
