namespace PoliValko.Ordering.Contracts;

public static class DeliveryCodes
{
    public const string NovaPoshta = "nova_poshta";
    public const string NovaPoshtaCourier = "nova_poshta_courier";
    public const string Pickup = "pickup";

    public static string From(DeliveryMethod method) => method switch
    {
        DeliveryMethod.Pickup => Pickup,
        DeliveryMethod.NovaPoshtaCourier => NovaPoshtaCourier,
        _ => NovaPoshta,
    };

    public static DeliveryMethod? Parse(string? code) => code switch
    {
        NovaPoshta => DeliveryMethod.NovaPoshta,
        NovaPoshtaCourier => DeliveryMethod.NovaPoshtaCourier,
        Pickup => DeliveryMethod.Pickup,
        _ => null,
    };
}
