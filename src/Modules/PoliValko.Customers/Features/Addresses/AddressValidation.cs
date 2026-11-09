using PoliValko.Customers.Domain;
using PoliValko.Delivery.Contracts;

namespace PoliValko.Customers.Features.Addresses;

internal static class AddressValidation
{
    public static async Task<(Dictionary<string, string[]> Errors, ValidatedAddress? Address)> ValidateAsync(
        SaveCustomerAddressRequest request,
        IDeliveryDirectory directory,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var label = string.IsNullOrWhiteSpace(request.Label) ? null : request.Label.Trim();
        if (label is { Length: > 50 })
        {
            errors["label"] = ["Назва адреси має бути не довшою за 50 символів."];
        }

        var method = AddressDeliveryCodes.All.FirstOrDefault(code => code == request.Method?.Trim());
        if (method is null)
        {
            errors["method"] = ["Оберіть доставку у відділення чи поштомат або кур'єром Нової пошти."];
        }

        var settlement = string.IsNullOrWhiteSpace(request.SettlementRef)
            ? null
            : await directory.FindSettlementAsync(request.SettlementRef.Trim(), ct);
        if (settlement is null)
        {
            errors["settlementRef"] = ["Оберіть населений пункт зі списку."];
        }

        Warehouse? warehouse = null;
        string? street = null, house = null, apartment = null;
        if (method == AddressDeliveryCodes.NovaPoshta && settlement is not null)
        {
            warehouse = string.IsNullOrWhiteSpace(request.WarehouseRef)
                ? null
                : await directory.FindWarehouseAsync(request.WarehouseRef.Trim(), ct);
            if (warehouse is null || warehouse.SettlementRef != settlement.Ref)
            {
                errors["warehouseRef"] = ["Оберіть відділення або поштомат зі списку."];
            }
        }
        else if (method == AddressDeliveryCodes.NovaPoshtaCourier)
        {
            street = request.Address?.Street?.Trim();
            house = request.Address?.House?.Trim();
            apartment = string.IsNullOrWhiteSpace(request.Address?.Apartment) ? null : request.Address.Apartment.Trim();
            if (string.IsNullOrEmpty(street) || street.Length is < 2 or > 150)
            {
                errors["address.street"] = ["Вкажіть вулицю."];
            }

            if (string.IsNullOrEmpty(house) || house.Length > 20)
            {
                errors["address.house"] = ["Вкажіть номер будинку."];
            }

            if (apartment is { Length: > 20 })
            {
                errors["address.apartment"] = ["Номер квартири має бути не довшим за 20 символів."];
            }
        }

        if (errors.Count > 0)
        {
            return (errors, null);
        }

        return (errors, new ValidatedAddress(label, method!, settlement!, warehouse, street, house, apartment));
    }

    public static void Apply(CustomerAddress address, ValidatedAddress valid)
    {
        address.Label = valid.Label;
        address.DeliveryMethod = valid.Method;
        address.SettlementRef = valid.Settlement.Ref;
        address.SettlementName = valid.Settlement.Name;
        address.WarehouseRef = valid.Warehouse?.Ref;
        address.WarehouseName = valid.Warehouse is { } w ? $"{w.Name}, {w.Address}" : null;
        address.Street = valid.Street;
        address.House = valid.House;
        address.Apartment = valid.Apartment;
    }

    internal sealed record ValidatedAddress(
        string? Label,
        string Method,
        Settlement Settlement,
        Warehouse? Warehouse,
        string? Street,
        string? House,
        string? Apartment);
}
