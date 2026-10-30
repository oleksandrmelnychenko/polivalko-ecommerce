using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using PoliValko.Catalog;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Navkolo;

public sealed record ImportRunDto(
    Guid Id,
    string Job,
    SyncRunStatus Status,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    string StartedBy,
    string? Summary,
    int ErrorCount,
    IReadOnlyList<SyncError> Errors);

/// <summary>
/// Первинний імпорт каталогу з файлу, який надає замовник (розділ 7 ТЗ): перевірка формату,
/// обов'язкових полів, дублікатів і категорій зі звітом помилок.
/// Формати: JSON-масив записів або CSV з колонками
/// <c>navkolo_id;sku;name;group;price;old_price;stock;brand;variant_group;variant_label;description</c>.
/// </summary>
public static class CatalogImportEndpoints
{
    public const long MaxFileBytes = 20 * 1024 * 1024;

    public static RouteGroupBuilder MapAdminNavkoloEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/integration/navkolo").WithTags("Admin").RequireStaff(StaffPolicies.Admin)
            .MapPost("/import", ImportAsync)
            .DisableAntiforgery() // CSRF перевіряє фільтр групи за заголовком X-CSRF-TOKEN.
            .WithName("AdminImportCatalog")
            .WithSummary("Імпорт каталогу з файлу JSON або CSV зі звітом помилок")
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return admin;
    }

    private static async Task<Results<Ok<ImportRunDto>, ValidationProblem>> ImportAsync(
        IFormFile file,
        ClaimsPrincipal user,
        ISyncJournal journal,
        ICatalogImporter importer,
        IAuditLog audit,
        PoliValkoDbContext db,
        CancellationToken ct)
    {
        if (file.Length == 0 || file.Length > MaxFileBytes)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = ["Файл порожній або більший за 20 МБ."] });
        }

        List<NavkoloProductRecord> records;
        try
        {
            await using var stream = file.OpenReadStream();
            records = file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase)
                ? await ParseCsvAsync(stream, ct)
                : await JsonSerializer.DeserializeAsync<List<NavkoloProductRecord>>(stream, JsonSerializerOptions.Web, ct) ?? [];
        }
        catch (Exception ex) when (ex is JsonException or FormatException)
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["file"] = [$"Файл не відповідає формату: {ex.Message}"] });
        }

        var run = await journal.RunAsync(NavkoloJobs.Import, user.StaffName(), async token =>
        {
            var result = await importer.ImportProductsAsync(records, token);
            return new SyncResult($"Файл {file.FileName}, рядків: {records.Count}. {result.Summary}", result.Errors);
        }, ct);

        audit.Record("catalog.imported", "CatalogImport", run.Id.ToString(), new { file.FileName, rows = records.Count, run.Status, run.ErrorCount });
        await db.SaveChangesAsync(ct);
        return TypedResults.Ok(ToDto(run));
    }

    public static ImportRunDto ToDto(SyncRun run) => new(
        run.Id,
        run.Job,
        run.Status,
        run.StartedAt,
        run.FinishedAt,
        run.StartedBy,
        run.Summary,
        run.ErrorCount,
        run.Errors is null ? [] : JsonSerializer.Deserialize<List<SyncError>>(run.Errors, JsonSerializerOptions.Web) ?? []);

    internal static async Task<List<NavkoloProductRecord>> ParseCsvAsync(Stream stream, CancellationToken ct)
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

    /// <summary>CSV з лапками; роздільник — крапка з комою або кома (за першим рядком).</summary>
    internal static List<List<string>> ParseCsv(string text)
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
