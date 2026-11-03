namespace PoliValko.Catalog.Contracts;

public sealed record ProductCard(Guid Id, string Name, string Sku, string? ImageUrl);
