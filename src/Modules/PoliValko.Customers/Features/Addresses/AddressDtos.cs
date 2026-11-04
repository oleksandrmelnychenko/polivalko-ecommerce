namespace PoliValko.Customers.Features.Addresses;

public sealed record StreetAddressRequest(string? Street, string? House, string? Apartment);

public sealed record SaveCustomerAddressRequest(
    string? Label,
    string? Method,
    string? SettlementRef,
    string? WarehouseRef,
    StreetAddressRequest? Address,
    bool IsDefault);

public sealed record StreetAddressDto(string Street, string House, string? Apartment);

public sealed record CustomerAddressDto(
    Guid Id,
    string? Label,
    string Method,
    string SettlementRef,
    string SettlementName,
    string? WarehouseRef,
    string? WarehouseName,
    StreetAddressDto? Address,
    bool IsDefault);
