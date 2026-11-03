using System.Globalization;
using System.Text;
using System.Text.Json;
using PoliValko.Catalog.Contracts;

namespace PoliValko.Navkolo.Features.CatalogImport;

internal static class CatalogFileParser
{
    public static async Task<List<NavkoloProductRecord>> ParseAsync(Stream stream, string fileName, CancellationToken ct) =>
        fileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
            ? await ParseCsvAsync(stream, ct)
            : await JsonSerializer.DeserializeAsync<List<NavkoloProductRecord>>(stream, JsonSerializerOptions.Web, ct) ?? [];

    public static async Task<List<NavkoloProductRecord>> ParseCsvAsync(Stream stream, CancellationToken ct)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        var text = await reader.ReadToEndAsync(ct);
        var rows = ParseCsv(text);
        if (rows.Count == 0)
        {
            return [];
        }

        var header = rows[0].Select(h => h.Trim().ToLowerInvariant()).ToList();
        string? Cell(List<string> row, string name)
        {
            var index = header.IndexOf(name);
            return index >= 0 && index < row.Count && !string.IsNullOrWhiteSpace(row[index]) ? row[index].Trim() : null;
        }

        decimal? Number(List<string> row, string name, int line)
        {
            var value = Cell(row, name)?.Replace(" ", string.Empty, StringComparison.Ordinal).Replace(',', '.');
            if (value is null)
            {
                return null;
            }

            return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var number)
                ? number
                : throw new FormatException($"рядок {line}: «{name}» не є числом");
        }

        if (!header.Contains("navkoloid") && !header.Contains("navkolo_id"))
        {
            throw new FormatException("немає колонки navkolo_id");
        }

        var idColumn = header.Contains("navkolo_id") ? "navkolo_id" : "navkoloid";
        return rows.Skip(1)
            .Where(r => r.Any(c => !string.IsNullOrWhiteSpace(c)))
            .Select((row, i) => new NavkoloProductRecord(
                Cell(row, idColumn),
                Cell(row, "sku"),
                Cell(row, "name"),
                Cell(row, "group"),
                Number(row, "price", i + 2),
                Number(row, "old_price", i + 2),
                Number(row, "stock", i + 2),
                Cell(row, "brand"),
                Cell(row, "variant_group"),
                Cell(row, "variant_label"),
                Cell(row, "description")))
            .ToList();
    }

    public static List<List<string>> ParseCsv(string text)
    {
        var firstLine = text.Split('\n', 2)[0];
        var separator = firstLine.Count(c => c == ';') >= firstLine.Count(c => c == ',') ? ';' : ',';
        var rows = new List<List<string>>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var quoted = false;

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (quoted)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"')
                {
                    cell.Append('"');
                    i++;
                }
                else if (c == '"')
                {
                    quoted = false;
                }
                else
                {
                    cell.Append(c);
                }
            }
            else if (c == '"')
            {
                quoted = true;
            }
            else if (c == separator)
            {
                row.Add(cell.ToString());
                cell.Clear();
            }
            else if (c == '\n')
            {
                row.Add(cell.ToString().TrimEnd('\r'));
                cell.Clear();
                rows.Add(row);
                row = [];
            }
            else
            {
                cell.Append(c);
            }
        }

        if (cell.Length > 0 || row.Count > 0)
        {
            row.Add(cell.ToString().TrimEnd('\r'));
            rows.Add(row);
        }

        return rows;
    }
}
