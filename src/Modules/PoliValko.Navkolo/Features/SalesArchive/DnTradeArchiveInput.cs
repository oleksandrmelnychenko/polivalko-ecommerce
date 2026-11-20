using System.Buffers;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PoliValko.Navkolo.Features.SalesArchive;

internal static class DnTradeArchiveInput
{
    public const int MaxBytes = 10 * 1024 * 1024;
    public const int MaxRecords = 1000;
    public const string ContentType = "application/x-ndjson";

    private static readonly UTF8Encoding Utf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);
    private static readonly HashSet<string> EntityTypes = new(StringComparer.Ordinal)
    {
        "invoice", "cashOrder", "bankPayment", "order", "partner", "store", "cashbox", "partnerCategory",
        "salesChannel", "orderStatus", "productCategory", "receipt", "customerReturn",
        "financialReport", "bankAccount", "debtAdjustment", "inventorySnapshot", "sourceReport",
    };

    public static bool IsEntityType(string value) => EntityTypes.Contains(value);

    public static bool IsAccount(string value) => value.Length is >= 1 and <= 64 &&
        value[0] != '-' && value[^1] != '-' && value.All(c => c is >= 'a' and <= 'z' or >= '0' and <= '9' or '-');

    public static async Task<IReadOnlyList<DnTradeArchiveRecord>> ReadAsync(
        Stream body, string sourceAccount, DateTimeOffset importedAt, CancellationToken ct)
    {
        using var input = new MemoryStream();
        var buffer = ArrayPool<byte>.Shared.Rent(64 * 1024);
        try
        {
            int read;
            while ((read = await body.ReadAsync(buffer.AsMemory(), ct)) != 0)
            {
                if (input.Length + read > MaxBytes) throw new ArchiveSizeException();
                input.Write(buffer, 0, read);
            }
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
        }

        input.Position = 0;
        using var reader = new StreamReader(input, Utf8, detectEncodingFromByteOrderMarks: false);
        var records = new List<DnTradeArchiveRecord>();
        var lineNumber = 0;
        try
        {
            while (await reader.ReadLineAsync(ct) is { } line)
            {
                lineNumber++;
                if (lineNumber == 1) line = line.TrimStart('\uFEFF');
                if (string.IsNullOrWhiteSpace(line)) continue;
                if (records.Count >= MaxRecords) throw new ArchiveSizeException();
                records.Add(Parse(line, sourceAccount, importedAt));
            }
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException)
        {
            throw new ArchiveInputException($"Рядок {lineNumber} не відповідає формату архіву DNTrade.");
        }
        catch (DecoderFallbackException)
        {
            throw new ArchiveInputException("Файл має бути в кодуванні UTF-8.");
        }

        if (records.Count == 0) throw new ArchiveInputException("Файл не містить записів.");
        return records;
    }

    private static DnTradeArchiveRecord Parse(string line, string sourceAccount, DateTimeOffset importedAt)
    {
        using var document = JsonDocument.Parse(line, new JsonDocumentOptions { MaxDepth = 48 });
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("schemaVersion", out var schema) ||
            schema.ValueKind != JsonValueKind.Number || !schema.TryGetInt32(out var version) || version != 1 ||
            Text(root, "source", 10) != "dntrade" || Text(root, "entityType", 32) is not { } entityType ||
            !IsEntityType(entityType) || Text(root, "sourceId", 200) is not { } sourceId ||
            !root.TryGetProperty("raw", out var raw) || raw.ValueKind != JsonValueKind.Object)
        {
            throw new JsonException();
        }

        var sourceDate = Text(root, "sourceDate", 48);
        DateOnly? parsedDay = sourceDate is null ? null : ParseDate(root.GetProperty("sourceDate"), sourceDate);
        var documentType = Text(root, "documentType", 96);
        var organizationId = Text(root, "organizationId", 200);
        var storeIds = ReadStoreIds(root);
        var status = Text(root, "status", 96);
        var currency = Text(root, "currency", 16);
        var total = ReadTotal(root);
        var parentSourceId = Text(root, "parentSourceId", 200);
        ValidateEnvelopeProperties(root);
        var fingerprint = GetFingerprint(new { sourceDate, documentType, organizationId, storeIds, status, currency, total, parentSourceId, raw });
        return new DnTradeArchiveRecord
        {
            SourceAccount = sourceAccount, EntityType = entityType, SourceId = sourceId,
            SourceDate = sourceDate, SourceDay = parsedDay, DocumentType = documentType, OrganizationId = organizationId,
            StoreIds = storeIds, Status = status, Currency = currency, Total = total, ParentSourceId = parentSourceId,
            ImportedAt = importedAt, Payload = line, Fingerprint = fingerprint,
        };
    }

    private static string? Text(JsonElement source, string name, int maxLength) =>
        source.TryGetProperty(name, out var element) && element.ValueKind != JsonValueKind.Null ? Text(element, maxLength) : null;

    private static string Text(JsonElement element, int maxLength)
    {
        if (element.ValueKind != JsonValueKind.String || element.GetString() is not { } value ||
            value.Length > maxLength || string.IsNullOrWhiteSpace(value) || value.Any(char.IsControl)) throw new JsonException();
        return value;
    }

    private static DateOnly ParseDate(JsonElement element, string value)
    {
        if (value.Length < 10 || !DateOnly.TryParseExact(value.AsSpan(0, 10), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day) ||
            (value.Length != 10 && (!value.Contains('T') || !element.TryGetDateTime(out _)))) throw new JsonException();
        return day;
    }

    private static string[] ReadStoreIds(JsonElement source)
    {
        if (!source.TryGetProperty("storeIds", out var value) || value.ValueKind == JsonValueKind.Null) return [];
        if (value.ValueKind != JsonValueKind.Array || value.GetArrayLength() > 100) throw new JsonException();
        return value.EnumerateArray().Select(item => Text(item, 200)).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal).ToArray();
    }

    private static decimal? ReadTotal(JsonElement source)
    {
        if (!source.TryGetProperty("total", out var value) || value.ValueKind == JsonValueKind.Null) return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var numeric)) return numeric;
        if (value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(),
            NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint | NumberStyles.AllowExponent,
            CultureInfo.InvariantCulture, out var text)) return text;
        throw new JsonException();
    }

    private static void ValidateEnvelopeProperties(JsonElement envelope)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var property in envelope.EnumerateObject())
        {
            if (!names.Add(property.Name)) throw new JsonException();
            switch (property.Name)
            {
                case "schemaVersion" or "source" or "entityType" or "sourceId" or "sourceDate" or "documentType" or "organizationId" or
                    "storeIds" or "status" or "currency" or "total" or "parentSourceId" or "raw":
                    break;
                case "providerTypeCode" or "requestedStatus" or "stream":
                    if (property.Value.ValueKind != JsonValueKind.Null) Text(property.Value, 200);
                    break;
                default:
                    throw new JsonException();
            }
        }
    }

    private static string GetFingerprint<T>(T normalized)
    {
        var data = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(data))
        {
            WriteCanonical(writer, JsonSerializer.SerializeToElement(normalized));
        }
        return Convert.ToHexString(SHA256.HashData(data.WrittenSpan));
    }

    private static void WriteCanonical(Utf8JsonWriter writer, JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                string? previous = null;
                foreach (var property in element.EnumerateObject().OrderBy(property => property.Name, StringComparer.Ordinal))
                {
                    if (property.Name == previous || property.Name.Contains('\0')) throw new JsonException();
                    previous = property.Name;
                    writer.WritePropertyName(property.Name);
                    WriteCanonical(writer, property.Value);
                }
                writer.WriteEndObject();
                break;
            case JsonValueKind.Array:
                writer.WriteStartArray();
                foreach (var item in element.EnumerateArray()) WriteCanonical(writer, item);
                writer.WriteEndArray();
                break;
            case JsonValueKind.String:
                var text = element.GetString();
                if (text?.Contains('\0') == true) throw new JsonException();
                writer.WriteStringValue(text);
                break;
            case JsonValueKind.Number:
                if (!element.TryGetDecimal(out var number)) throw new JsonException();
                writer.WriteNumberValue(number);
                break;
            default:
                element.WriteTo(writer);
                break;
        }
    }
}

internal sealed class ArchiveSizeException() : Exception;
internal sealed class ArchiveInputException(string message) : Exception(message);
