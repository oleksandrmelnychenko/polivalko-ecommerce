namespace PoliValko.Ordering.Features.Shop;

public sealed record ShopSellerDto(string Name, string? TaxId, string? Address, string? Iban, string? Email, string? Phone);

public sealed record ShopSpecialDayDto(DateOnly Date, string Label, bool Closed, string? Hours);

public sealed record ShopSettingsDto(ShopSellerDto Seller, IReadOnlyList<ShopSpecialDayDto> SpecialDays);
