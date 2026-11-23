using System.Globalization;
using System.Text.Json;

namespace PoliValko.Navkolo.Features.SalesArchive;

internal enum DnTradeSalesKind { Unknown, Other, Invoice, Receipt, Return }

internal sealed record DnTradeSalesLine(string? ProviderId, string? Code, string? Sku, string Name, decimal Quantity, decimal Total);

internal sealed record DnTradeSalesDocument(string Account, string Id, string? ParentId, DateOnly Day, DnTradeSalesKind Kind,
    IReadOnlyList<DnTradeSalesLine> Lines)
{
    // DNTrade /invoices/list enum and Invoice.products schema.
    // https://api.dntrade.com.ua/docs/swagger.json
    internal static DnTradeSalesDocument? Read(DnTradeArchiveRecord row, DateOnly day, out bool incomplete)
    {
        incomplete = false;
        using var json = JsonDocument.Parse(row.Payload, new JsonDocumentOptions { MaxDepth = 48 });
        var envelope = json.RootElement;
        var raw = Property(envelope, "raw");
        var code = KindOf(Text(envelope, "providerTypeCode"));
        var normalized = KindOf(row.DocumentType);
        var provider = KindOf(Text(raw, "type"));
        var kind = code != DnTradeSalesKind.Unknown ? code : normalized != DnTradeSalesKind.Unknown ? normalized : provider;
        if (kind == DnTradeSalesKind.Other) return null;

        var providerStatus = Normalize(Text(raw, "status"));
        var normalizedStatus = Normalize(row.Status);
        var requestedStatus = Normalize(Text(envelope, "requestedStatus"));
        if (IsInactive(providerStatus) || IsInactive(normalizedStatus) || IsInactive(requestedStatus)) return null;

        var currency = Text(raw, "currency_iso");
        if ((row.Currency is not null && !IsHryvnia(row.Currency)) || (currency is not null && !IsHryvnia(currency)))
        {
            incomplete = true;
            return null;
        }

        var products = Property(raw, "products");
        if (kind == DnTradeSalesKind.Unknown || Conflicts(kind, normalized) || Conflicts(kind, provider) ||
            (!IsActive(providerStatus) && !IsActive(normalizedStatus) && !IsActive(requestedStatus)) ||
            (currency is null && row.Currency is null) || products.ValueKind != JsonValueKind.Array || products.GetArrayLength() == 0)
        {
            incomplete = true;
            return null;
        }

        var lines = new List<DnTradeSalesLine>();
        foreach (var item in products.EnumerateArray())
        {
            var line = ReadLine(item, kind == DnTradeSalesKind.Return);
            if (line is null) incomplete = true;
            else lines.Add(line);
        }

        return lines.Count == 0 ? null : new(row.SourceAccount, Identifier(Text(raw, "external_id")) ?? row.SourceId,
            Identifier(Text(raw, "parent_document")) ?? Identifier(row.ParentSourceId), day, kind, lines);
    }

    private static DnTradeSalesLine? ReadLine(JsonElement item, bool isReturn)
    {
        var product = Property(item, "product");
        var id = Guid.TryParse(Text(product, "id"), out var guid) && guid != Guid.Empty ? guid.ToString() : null;
        var code = Text(product, "code", 100);
        var sku = Text(product, "sku", 100);
        if ((id is null && code is null && sku is null) || !TryDecimal(item, "quantity", out var quantity) ||
            !TryDecimal(item, "total", out var total) || quantity == 0 || (!isReturn && (quantity < 0 || total < 0)))
        {
            return null;
        }

        return new DnTradeSalesLine(id, code, sku, Text(product, "title", 500) ?? sku ?? code ?? id!,
            decimal.Abs(quantity), decimal.Abs(total));
    }

    private static DnTradeSalesKind KindOf(string? type) => Normalize(type) switch
    {
        "3" or "sale" or "salesinvoice" or "outgoinginvoice" or "видаткованакладна" => DnTradeSalesKind.Invoice,
        "6" or "receipt" or "salereceipt" or "salebyreceipt" or "продажпочеку" or "продажапочеку" => DnTradeSalesKind.Receipt,
        "7" or "return" or "customerreturn" or "поверненнятовару" => DnTradeSalesKind.Return,
        "1" or "2" or "4" or "5" or "8" or "9" or "10" or "11" or "12" or "13" or "14" or "15" or "16" or "17" or "18"
            or "paymentinvoice" or "purchaseinvoice" or "incominginvoice" or "stockreceipt" or "stocktransfer" or "writeoff"
            or "employeesale" or "inventory" or "employeereturn" or "supplierreturn" or "purchaseorder" or "onlineorder"
            or "рахунокнаоплату" or "прихіднанакладна" or "прибуткованакладна" or "оприбуткуваннятоварів" or "переміщеннятоварів"
            or "списаннятовару" or "продажтоваруврахунокзарплати" or "продажатоваруврахунокзарплати" or "інвентаризаціятоварів"
            or "поверненнявідспівробітника" or "поверненнятоварівпостачальнику" or "оприбуткуваннятоварівзвиробництва"
            or "коригуваннязалишківнаскладах" or "розфасовкатоварівзвиробництва" or "звітвиробничоїзміни" or "замовленнятовару"
            or "онлайнзамовлення"
            => DnTradeSalesKind.Other,
        _ => DnTradeSalesKind.Unknown,
    };

    private static bool Conflicts(DnTradeSalesKind kind, DnTradeSalesKind other) =>
        other == DnTradeSalesKind.Other || (other != DnTradeSalesKind.Unknown &&
            (kind == DnTradeSalesKind.Return) != (other == DnTradeSalesKind.Return));

    private static string Normalize(string? value) => value is null ? string.Empty :
        value.Any(char.IsLetter) ? string.Concat(value.Where(char.IsLetterOrDigit)).ToLowerInvariant() : value.Trim();

    private static bool IsActive(string value) => value is "active" or "активний" or "активна";

    private static bool IsInactive(string value) => value is "deactivated" or "deleted" or "inactive" or "draft"
        or "cancelled" or "canceled" or "видалений" or "видалена" or "деактивований" or "деактивована" or "чернетка";

    private static bool IsHryvnia(string value) => value.Trim().Equals("UAH", StringComparison.OrdinalIgnoreCase) || value.Trim() == "980";

    private static string? Identifier(string? value) => value == "0" || Guid.TryParse(value, out var id) && id == Guid.Empty ? null : value;

    private static bool TryDecimal(JsonElement source, string name, out decimal value) =>
        // The archive accepts lossless decimals. Limit unusable magnitudes before summing business values.
        decimal.TryParse(Text(source, name, 48), NumberStyles.Float, CultureInfo.InvariantCulture, out value) &&
        value is >= -1_000_000_000_000_000m and <= 1_000_000_000_000_000m;

    private static JsonElement Property(JsonElement source, string name) =>
        source.ValueKind == JsonValueKind.Object && source.TryGetProperty(name, out var value) ? value : default;

    private static string? Text(JsonElement source, string name, int maxLength = 200)
    {
        var value = Property(source, name);
        var text = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString()?.Trim(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
        return text is { Length: > 0 } && text.Length <= maxLength && !text.Any(char.IsControl) ? text : null;
    }
}
