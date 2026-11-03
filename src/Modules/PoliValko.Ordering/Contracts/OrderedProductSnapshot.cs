namespace PoliValko.Ordering.Contracts;

public sealed record OrderedProductSnapshot(Guid ProductId, string Name, string Sku, string? ImageUrl);
