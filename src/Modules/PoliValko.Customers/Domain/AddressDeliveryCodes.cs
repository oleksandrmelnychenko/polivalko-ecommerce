namespace PoliValko.Customers.Domain;

public static class AddressDeliveryCodes
{
    public const string NovaPoshta = "nova_poshta";
    public const string NovaPoshtaCourier = "nova_poshta_courier";

    public static readonly IReadOnlyList<string> All = [NovaPoshta, NovaPoshtaCourier];
}
