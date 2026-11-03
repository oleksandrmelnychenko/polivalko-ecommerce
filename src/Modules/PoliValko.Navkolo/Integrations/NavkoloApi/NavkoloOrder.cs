namespace PoliValko.Navkolo.Integrations.NavkoloApi;

public sealed record NavkoloOrder(
    string Number,
    DateTimeOffset CreatedAt,
    string CustomerName,
    string CustomerPhone,
    string Delivery,
    string Payment,
    decimal Total,
    string? Comment,
    IReadOnlyList<NavkoloOrderLine> Lines);
