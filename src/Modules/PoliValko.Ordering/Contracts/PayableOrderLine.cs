namespace PoliValko.Ordering.Contracts;

public sealed record PayableOrderLine(string Name, string Sku, int Quantity, decimal UnitPrice);
