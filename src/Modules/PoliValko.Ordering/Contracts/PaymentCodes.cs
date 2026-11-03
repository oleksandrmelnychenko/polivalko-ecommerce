namespace PoliValko.Ordering.Contracts;

public static class PaymentCodes
{
    public const string Card = "card";
    public const string CashOnDelivery = "cash_on_delivery";
    public const string PayOnPickup = "pay_on_pickup";

    public static string From(PaymentMethod method) => method switch
    {
        PaymentMethod.CashOnDelivery => CashOnDelivery,
        PaymentMethod.PayOnPickup => PayOnPickup,
        _ => Card,
    };

    public static PaymentMethod? Parse(string? code) => code switch
    {
        Card => PaymentMethod.Card,
        CashOnDelivery => PaymentMethod.CashOnDelivery,
        PayOnPickup => PaymentMethod.PayOnPickup,
        _ => null,
    };
}
