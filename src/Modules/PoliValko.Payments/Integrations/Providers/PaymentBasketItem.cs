namespace PoliValko.Payments.Integrations.Providers;

public sealed record PaymentBasketItem(string Name, string Code, int Quantity, decimal UnitPrice);
