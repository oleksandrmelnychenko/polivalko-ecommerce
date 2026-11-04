using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Customers.Domain;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Customers.Features.Addresses;

internal static class AddressMapping
{
    public static CustomerAddressDto ToDto(CustomerAddress address) => new(
        address.Id,
        address.Label,
        address.DeliveryMethod,
        address.SettlementRef,
        address.SettlementName,
        address.WarehouseRef,
        address.WarehouseName,
        address.Street is not null && address.House is not null ? new StreetAddressDto(address.Street, address.House, address.Apartment) : null,
        address.IsDefault);

    public static ProblemHttpResult NotFound() =>
        Problems.NotFound("account.address_not_found", "Адресу не знайдено", "Можливо, її вже видалено.");
}
