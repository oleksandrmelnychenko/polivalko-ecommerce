using System.Globalization;
using System.Text.Json;
using PoliValko.Delivery.Contracts;
using PoliValko.Delivery.Domain;
using static PoliValko.Delivery.Integrations.NovaPoshta.NovaPoshtaResponseParser;

namespace PoliValko.Delivery.Integrations.NovaPoshta;

internal static class NovaPoshtaMapper
{
    public static readonly HashSet<string> PostomatTypeRefs = new(StringComparer.OrdinalIgnoreCase)
    {
        "95dc212d-479c-4ffb-a8ab-8c1b9073d0bc",
        "f9316480-5f2d-425d-bc2c-ac7cd29decf0",
    };

    public static NovaPoshtaArea? MapArea(JsonElement element) =>
        Text(element, "Ref") is { } reference && Text(element, "Description") is { } name
            ? new NovaPoshtaArea(reference, name)
            : null;

    public static Settlement? MapCity(JsonElement element, IReadOnlyDictionary<string, string> areas)
    {
        var reference = Text(element, "Ref");
        var name = Text(element, "Description");
        if (reference is null || name is null || reference.Length > DeliveryLimits.RefLength)
        {
            return null;
        }

        var area = Text(element, "AreaDescription")
                   ?? (Text(element, "Area") is { } areaRef && areas.TryGetValue(areaRef, out var areaName) ? areaName : null);
        return new Settlement(
            reference,
            NovaPoshtaText.Truncate(name, DeliveryLimits.SettlementNameLength),
            NovaPoshtaText.Truncate(FormatArea(area), DeliveryLimits.AreaLength));
    }

    public static Warehouse? MapWarehouse(JsonElement element)
    {
        var reference = Text(element, "Ref");
        var cityRef = Text(element, "CityRef");
        var description = Text(element, "Description");
        if (reference is null || cityRef is null || description is null
            || reference.Length > DeliveryLimits.RefLength || cityRef.Length > DeliveryLimits.RefLength)
        {
            return null;
        }

        if (Text(element, "WarehouseStatus") is { } status && !status.Equals("Working", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (Text(element, "DenyToSelect") == "1")
        {
            return null;
        }

        var isPostomat = (Text(element, "CategoryOfWarehouse") is { } category && category.Equals("Postomat", StringComparison.OrdinalIgnoreCase))
                         || (Text(element, "TypeOfWarehouse") is { } typeRef && PostomatTypeRefs.Contains(typeRef));
        var number = int.TryParse(Text(element, "Number"), NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0;
        var (name, address) = SplitDescription(description, Text(element, "ShortAddress"));

        return new Warehouse(
            reference,
            cityRef,
            number,
            NovaPoshtaText.Truncate(name, DeliveryLimits.WarehouseNameLength),
            NovaPoshtaText.Truncate(address, DeliveryLimits.WarehouseAddressLength),
            isPostomat ? WarehouseType.Postomat : WarehouseType.Branch);
    }

    public static (string Name, string Address) SplitDescription(string description, string? shortAddress)
    {
        var colon = description.IndexOf(':');
        if (colon > 0)
        {
            var name = description[..colon].Trim();
            var address = description[(colon + 1)..].Trim();
            if (name.Length > 0 && address.Length > 0)
            {
                return (name, address);
            }
        }

        return (description, shortAddress ?? string.Empty);
    }

    public static string FormatArea(string? area) =>
        string.IsNullOrWhiteSpace(area) ? string.Empty
        : area.EndsWith("ька", StringComparison.Ordinal) ? $"{area} обл."
        : area;
}
