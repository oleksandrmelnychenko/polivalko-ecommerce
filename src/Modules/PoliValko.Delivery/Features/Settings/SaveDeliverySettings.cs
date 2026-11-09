using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Delivery.Features.Settings;

internal static class SaveDeliverySettings
{
    public const int TextLength = 200;

    public static async Task<Results<Ok<DeliverySettingsDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        DeliverySettingsDto request,
        ISettingsStore settings,
        IAuditLog audit,
        IStorefrontCache storefront,
        HttpContext http,
        CancellationToken ct)
    {
        var novaPoshta = request.NovaPoshta ?? DeliverySettingsStore.Defaults.NovaPoshta;
        var courier = request.Courier ?? DeliverySettingsStore.Defaults.Courier;
        var pickup = request.Pickup ?? DeliverySettingsStore.Defaults.Pickup;
        var errors = new Dictionary<string, string[]>();
        var area = Text(errors, "courier.area", courier.Area);
        var priceNote = Text(errors, "courier.priceNote", courier.PriceNote);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        if (!novaPoshta.Enabled && !courier.Enabled && !pickup.Enabled)
        {
            return Problems.Create(
                StatusCodes.Status400BadRequest,
                "delivery.no_methods",
                "Увімкніть хоча б один спосіб доставки",
                "Коли всі способи вимкнені, покупець не зможе оформити замовлення.");
        }

        var value = new DeliverySettingsDto(
            new NovaPoshtaSettingsDto(novaPoshta.Enabled, novaPoshta.CashOnDelivery),
            new CourierSettingsDto(courier.Enabled, area, priceNote),
            new PickupSettingsDto(pickup.Enabled));
        var before = await DeliverySettingsStore.LoadAsync(settings, ct);
        audit.Record("delivery.settings_updated", "DeliverySettings", null, new { before, after = value });
        await settings.SaveAsync(DeliverySettingsStore.SettingsKey, value, http.User.StaffName(), ct);
        await storefront.InvalidateAsync([StorefrontTags.Delivery], ct);
        return TypedResults.Ok(value);
    }

    private static string? Text(Dictionary<string, string[]> errors, string field, string? value)
    {
        var text = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (text is { Length: > TextLength })
        {
            errors[field] = [$"Текст має бути не довшим за {TextLength} символів."];
        }

        return text;
    }
}
