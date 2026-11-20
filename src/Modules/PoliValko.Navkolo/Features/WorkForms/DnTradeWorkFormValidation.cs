using System.Globalization;

namespace PoliValko.Navkolo.Features.WorkForms;

internal static class DnTradeWorkFormValidation
{
    private const int MaxLines = 100;
    private const int MaxWholeDigits = 12;

    public static bool IsSection(string? section) => section is "sales" or "finance" or "warehouse" or "directory";

    public static bool IsStatus(string? status) => status is "draft" or "ready" or "archived";

    public static Dictionary<string, string[]> Validate(SaveDnTradeWorkFormRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.ExpectedVersion is <= 0) Add(errors, "expectedVersion", "Вкажіть дійсну версію форми.");
        if (!IsSection(request.Section)) Add(errors, "section", "Невідомий розділ форми.");
        if (SectionFor(request.Type) is not { } section || !string.Equals(section, request.Section, StringComparison.Ordinal))
            Add(errors, "type", "Оберіть тип форми, що належить до цього розділу.");
        if (!IsStatus(request.Status) || (request.ExpectedVersion is null && request.Status == "archived"))
            Add(errors, "status", "Оберіть доступний стан форми.");
        if (!HasText(request.Title)) Add(errors, "title", "Вкажіть назву форми.");
        Text(errors, "title", request.Title, 200);
        if (request.SourceRecordId == Guid.Empty) Add(errors, "sourceRecordId", "Некоректний запис архіву.");
        if (request.Data is not { } data)
        {
            Add(errors, "data", "Вкажіть дані форми.");
            return errors;
        }

        Text(errors, "data.number", data.Number, 100);
        Text(errors, "data.organization", data.Organization, 200);
        Text(errors, "data.counterparty", data.Counterparty, 200);
        Text(errors, "data.warehouse", data.Warehouse, 200);
        Text(errors, "data.destinationWarehouse", data.DestinationWarehouse, 200);
        Text(errors, "data.account", data.Account, 200);
        Text(errors, "data.name", data.Name, 200);
        Text(errors, "data.code", data.Code, 100);
        Text(errors, "data.referenceKind", data.ReferenceKind, 200);
        Text(errors, "data.phone", data.Phone, 64);
        Text(errors, "data.email", data.Email, 254);
        Text(errors, "data.note", data.Note, 5000, multiline: true);
        if (!string.IsNullOrEmpty(data.Direction) && data.Direction is not ("in" or "out"))
            Add(errors, "data.direction", "Оберіть надходження або вибуття.");
        if (!string.IsNullOrEmpty(data.Currency) && (data.Currency.Length != 3 || data.Currency.Any(c => c is < 'A' or > 'Z')))
            Add(errors, "data.currency", "Вкажіть три великі латинські літери коду валюти.");
        Decimal(errors, "data.amount", data.Amount, 2);

        if (data.Lines is { } lines)
        {
            if (lines.Count > MaxLines)
                Add(errors, "data.lines", $"У формі може бути до {MaxLines} рядків.");
            else
                for (var i = 0; i < lines.Count; i++) ValidateLine(errors, i, lines[i]);
        }

        if (request.Status == "ready" && errors.Count == 0) ValidateReady(errors, request, data);
        return errors;
    }

    private static string? SectionFor(string? type) => type switch
    {
        "sale" or "purchase" or "return" => "sales",
        "cash" or "bank" or "opening-balance" or "reconciliation" => "finance",
        "inventory" or "movement" => "warehouse",
        "counterparty" or "reference" => "directory",
        _ => null,
    };

    private static void ValidateLine(Dictionary<string, string[]> errors, int index, DnTradeWorkFormLine? line)
    {
        var field = $"data.lines[{index}]";
        if (line is null)
        {
            Add(errors, field, "Рядок має містити поля товару.");
            return;
        }

        Text(errors, $"{field}.sku", line.Sku, 100);
        Text(errors, $"{field}.description", line.Description, 500, multiline: true);
        Text(errors, $"{field}.unit", line.Unit, 32);
        Decimal(errors, $"{field}.quantity", line.Quantity, 3);
        Decimal(errors, $"{field}.expectedQuantity", line.ExpectedQuantity, 3);
        Decimal(errors, $"{field}.unitPrice", line.UnitPrice, 2);
    }

    private static void ValidateReady(Dictionary<string, string[]> errors, SaveDnTradeWorkFormRequest request, DnTradeWorkFormData data)
    {
        if (request.Section != "directory" && request.DocumentDate is null)
            Add(errors, "documentDate", "Вкажіть дату документа перед передачею на перевірку.");

        switch (request.Type)
        {
            case "sale" or "purchase" or "return":
                RequireText(errors, "data.currency", data.Currency, "Вкажіть валюту.");
                ReadyLines(errors, data.Lines, allowZeroQuantity: false, requireUnitPrice: true);
                break;
            case "cash" or "bank":
                RequireText(errors, "data.organization", data.Organization, "Вкажіть організацію.");
                RequireText(errors, "data.account", data.Account, "Вкажіть касу або рахунок.");
                RequireText(errors, "data.direction", data.Direction, "Оберіть надходження або вибуття.");
                RequireText(errors, "data.currency", data.Currency, "Вкажіть валюту.");
                if (!ReadDecimal(data.Amount, 2, out var amount) || amount <= 0)
                    Add(errors, "data.amount", "Вкажіть суму операції, більшу за нуль.");
                break;
            case "opening-balance":
                RequireText(errors, "data.organization", data.Organization, "Вкажіть організацію.");
                RequireText(errors, "data.account", data.Account, "Вкажіть касу або рахунок.");
                RequireText(errors, "data.amount", data.Amount, "Вкажіть початковий залишок.");
                RequireText(errors, "data.currency", data.Currency, "Вкажіть валюту.");
                break;
            case "reconciliation":
                RequireText(errors, "data.counterparty", data.Counterparty, "Вкажіть контрагента.");
                RequireText(errors, "data.amount", data.Amount, "Вкажіть суму звірки.");
                RequireText(errors, "data.currency", data.Currency, "Вкажіть валюту.");
                break;
            case "inventory" or "movement":
                RequireText(errors, "data.warehouse", data.Warehouse, "Вкажіть склад.");
                if (request.Type == "movement")
                {
                    if (!HasText(data.DestinationWarehouse) || string.Equals(data.DestinationWarehouse?.Trim(), data.Warehouse?.Trim(), StringComparison.OrdinalIgnoreCase))
                        Add(errors, "data.destinationWarehouse", "Вкажіть інший склад призначення.");
                }
                ReadyLines(errors, data.Lines, allowZeroQuantity: request.Type == "inventory");
                break;
            case "counterparty" or "reference":
                RequireText(errors, "data.name", data.Name, "Вкажіть назву запису.");
                break;
        }
    }

    private static void ReadyLines(Dictionary<string, string[]> errors, IReadOnlyList<DnTradeWorkFormLine>? lines,
        bool allowZeroQuantity, bool requireUnitPrice = false)
    {
        if (lines is not { Count: > 0 })
        {
            Add(errors, "data.lines", "Додайте щонайменше один рядок товару.");
            return;
        }

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (!HasText(line.Sku) && !HasText(line.Description))
                Add(errors, $"data.lines[{i}].description", "Вкажіть артикул або опис товару.");
            if (!ReadDecimal(line.Quantity, 3, out var quantity) || quantity < 0 || (!allowZeroQuantity && quantity == 0))
                Add(errors, $"data.lines[{i}].quantity", allowZeroQuantity ? "Вкажіть фактичну невід’ємну кількість." : "Вкажіть кількість, більшу за нуль.");
            if (requireUnitPrice && (!ReadDecimal(line.UnitPrice, 2, out var price) || price < 0))
                Add(errors, $"data.lines[{i}].unitPrice", "Вкажіть невід’ємну ціну за одиницю.");
        }
    }

    private static void Text(Dictionary<string, string[]> errors, string field, string? value, int maxLength, bool multiline = false)
    {
        if (value is null) return;
        if (value.Length > maxLength || value.Any(c => char.IsControl(c) && !(multiline && (c is '\r' or '\n' or '\t'))))
            Add(errors, field, $"До {maxLength} символів. Вилучіть недопустимі символи.");
    }

    private static void Decimal(Dictionary<string, string[]> errors, string field, string? value, int precision)
    {
        if (!string.IsNullOrEmpty(value) && !ReadDecimal(value, precision, out _))
            Add(errors, field, $"Вкажіть десяткове число з крапкою. До {MaxWholeDigits} цілих і {precision} дробових цифр.");
    }

    private static bool ReadDecimal(string? value, int precision, out decimal result)
    {
        result = 0;
        if (string.IsNullOrEmpty(value)) return false;
        var digits = value.AsSpan(value[0] == '-' ? 1 : 0);
        var dot = digits.IndexOf('.');
        var whole = dot < 0 ? digits : digits[..dot];
        if (whole.Length is < 1 or > MaxWholeDigits || !AllDigits(whole)) return false;
        if (dot >= 0)
        {
            var fractional = digits[(dot + 1)..];
            if (fractional.IsEmpty || fractional.Length > precision || !AllDigits(fractional)) return false;
        }

        return decimal.TryParse(value, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out result);
    }

    private static bool AllDigits(ReadOnlySpan<char> value)
    {
        foreach (var digit in value)
            if (!char.IsAsciiDigit(digit)) return false;
        return true;
    }

    private static bool HasText(string? value) => !string.IsNullOrWhiteSpace(value);

    private static void RequireText(Dictionary<string, string[]> errors, string field, string? value, string message)
    {
        if (!HasText(value)) Add(errors, field, message);
    }

    private static void Add(Dictionary<string, string[]> errors, string field, string message) => errors.TryAdd(field, [message]);
}
