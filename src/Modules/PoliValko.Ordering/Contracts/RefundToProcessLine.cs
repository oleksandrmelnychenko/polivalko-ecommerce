namespace PoliValko.Ordering.Contracts;

public sealed record RefundToProcessLine(string Name, string Sku, int Quantity, decimal UnitPrice);
