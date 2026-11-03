namespace PoliValko.Navkolo.Integrations.NavkoloApi;

public sealed record NavkoloOrderLine(string Sku, string Name, int Quantity, decimal UnitPrice);
