namespace PoliValko.Ordering.Configuration;

public sealed class SellerOptions
{
    public string Name { get; set; } = "реквізити продавця уточнюються";

    public string? TaxId { get; set; }

    public string? Address { get; set; }
}
