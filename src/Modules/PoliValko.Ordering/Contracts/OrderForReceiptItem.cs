namespace PoliValko.Ordering.Contracts;

public sealed record OrderForReceiptItem(Guid Id, string Sku, string Name, decimal UnitPrice, int Quantity);
