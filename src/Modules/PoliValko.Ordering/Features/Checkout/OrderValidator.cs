using System.Globalization;
using PoliValko.Delivery.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.Ordering.Features.Checkout;

internal static class OrderValidator
{
    public static async Task<(Dictionary<string, string[]> Errors, ValidatedOrder? Order)> ValidateAsync(
        CreateOrderRequest request,
        IDeliveryDirectory directory,
        DeliveryAvailability availability,
        bool card,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        CheckoutCalculator.ValidateItems(request.Items, errors);

        if (!decimal.TryParse(request.ExpectedTotal, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var expectedTotal))
        {
            errors["expectedTotal"] = ["Передайте суму, яку бачив покупець, у форматі «1234.00»."];
        }

        var name = request.Customer?.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length is < 2 or > 100 || name.Any(char.IsControl))
        {
            errors["customer.name"] = ["Вкажіть ім'я та прізвище (від 2 до 100 символів)."];
        }

        if (!PhoneNumber.TryNormalizeUa(request.Customer?.Phone, out var phone))
        {
            errors["customer.phone"] = ["Вкажіть український номер телефону, наприклад +380 67 123 45 67."];
        }

        var email = request.Customer?.Email?.Trim() ?? string.Empty;
        if (email.Length == 0)
        {
            errors["customer.email"] = ["Вкажіть email."];
        }
        else if (!EmailAddress.IsValid(email))
        {
            errors["customer.email"] = ["Перевірте email, наприклад name@example.com."];
        }

        string? recipientName = null;
        string? recipientPhone = null;
        if (request.Recipient is { } recipient)
        {
            recipientName = recipient.Name?.Trim();
            if (string.IsNullOrEmpty(recipientName) || recipientName.Length is < 2 or > 100 || HasControl(recipientName))
                errors["recipient.name"] = ["Вкажіть ім'я та прізвище отримувача (від 2 до 100 символів)."];
            if (!PhoneNumber.TryNormalizeUa(recipient.Phone, out var normalizedRecipientPhone))
                errors["recipient.phone"] = ["Вкажіть український номер телефону отримувача."];
            else recipientPhone = normalizedRecipientPhone;
        }

        var delivery = DeliveryCodes.Parse(request.Delivery?.Method);
        Settlement? settlement = null;
        Warehouse? warehouse = null;
        string? address = null;
        if (delivery is null)
        {
            errors["delivery.method"] = ["Оберіть спосіб отримання."];
        }
        else if (!CheckoutCalculator.IsOffered(availability, card, delivery.Value))
        {
            errors["delivery.method"] = ["Цей спосіб отримання зараз недоступний. Оберіть інший."];
        }
        else if (delivery is DeliveryMethod.NovaPoshta or DeliveryMethod.NovaPoshtaCourier)
        {
            settlement = string.IsNullOrWhiteSpace(request.Delivery!.SettlementRef)
                ? null
                : await directory.FindSettlementAsync(request.Delivery.SettlementRef, ct);
            if (settlement is null)
            {
                errors["delivery.settlementRef"] = ["Оберіть населений пункт зі списку."];
            }
            else if (delivery == DeliveryMethod.NovaPoshtaCourier)
            {
                address = ValidateAddress(request.Delivery.Address, errors);
            }
            else
            {
                warehouse = string.IsNullOrWhiteSpace(request.Delivery.WarehouseRef)
                    ? null
                    : await directory.FindWarehouseAsync(request.Delivery.WarehouseRef, ct);
                if (warehouse is null || warehouse.SettlementRef != settlement.Ref)
                {
                    errors["delivery.warehouseRef"] = ["Оберіть відділення або поштомат зі списку."];
                }
            }
        }

        var payment = PaymentCodes.Parse(request.Payment?.Method);
        if (payment is null)
        {
            errors["payment.method"] = ["Оберіть спосіб оплати."];
        }
        else if (delivery is { } d && CheckoutCalculator.IsOffered(availability, card, d) && !CheckoutCalculator.IsAllowed(availability, card, d, payment.Value))
        {
            errors["payment.method"] = ["Цей спосіб оплати недоступний для обраного способу отримання."];
        }

        var comment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        if (comment is { Length: > 1000 })
        {
            errors["comment"] = ["Коментар має бути не довшим за 1000 символів."];
        }
        else if (HasControl(comment, multiline: true))
        {
            errors["comment"] = ["Коментар містить недопустимі символи."];
        }

        if (!request.AcceptOffer)
        {
            errors["acceptOffer"] = ["Підтвердіть згоду з умовами публічної оферти."];
        }

        if (errors.Count > 0)
        {
            return (errors, null);
        }

        return (errors, new ValidatedOrder(name!, phone, email, delivery!.Value, settlement, warehouse, address, payment!.Value, decimal.Round(expectedTotal, 2), comment, recipientName, recipientPhone, request.NoCallback));
    }

    private static bool HasControl(string? value, bool multiline = false) =>
        value is not null && value.Any(c => char.IsControl(c) && !(multiline && c is '\n' or '\r' or '\t'));

    private static string? ValidateAddress(DeliveryAddressRequest? address, Dictionary<string, string[]> errors)
    {
        var street = address?.Street?.Trim();
        var house = address?.House?.Trim();
        var apartment = address?.Apartment?.Trim();
        if (string.IsNullOrEmpty(street) || street.Length is < 2 or > 150 || HasControl(street))
        {
            errors["delivery.address.street"] = ["Вкажіть вулицю."];
        }

        if (string.IsNullOrEmpty(house) || house.Length > 20 || HasControl(house))
        {
            errors["delivery.address.house"] = ["Вкажіть номер будинку."];
        }

        if (apartment is { Length: > 20 } || HasControl(apartment))
        {
            errors["delivery.address.apartment"] = ["Номер квартири має бути не довшим за 20 символів."];
        }

        if (string.IsNullOrEmpty(street) || string.IsNullOrEmpty(house) || errors.Keys.Any(k => k.StartsWith("delivery.address", StringComparison.Ordinal)))
        {
            return null;
        }

        return string.IsNullOrEmpty(apartment) ? $"{street}, буд. {house}" : $"{street}, буд. {house}, кв. {apartment}";
    }

    internal sealed record ValidatedOrder(
        string Name,
        string Phone,
        string Email,
        DeliveryMethod Delivery,
        Settlement? Settlement,
        Warehouse? Warehouse,
        string? Address,
        PaymentMethod Payment,
        decimal ExpectedTotal,
        string? Comment,
        string? RecipientName,
        string? RecipientPhone,
        bool NoCallback);
}
