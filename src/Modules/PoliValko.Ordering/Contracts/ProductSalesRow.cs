namespace PoliValko.Ordering.Contracts;

public sealed record ProductSalesRow(Guid ProductId, int Quantity, decimal Revenue);
