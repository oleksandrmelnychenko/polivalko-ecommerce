namespace PoliValko.Catalog.Contracts;

public sealed record ProductSearchHit(Guid Id, string Name, string Sku, string? ImageUrl, decimal Price, bool IsVisible);
