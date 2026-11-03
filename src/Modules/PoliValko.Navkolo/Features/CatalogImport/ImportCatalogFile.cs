using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Sync;
using PoliValko.Navkolo.Contracts;

namespace PoliValko.Navkolo.Features.CatalogImport;

internal static class ImportCatalogFile
{
    public const long MaxFileBytes = 20 * 1024 * 1024;

    public static async Task<Results<Ok<ImportRunDto>, ValidationProblem>> HandleAsync(
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
            records = await CatalogFileParser.ParseAsync(stream, file.FileName, ct);
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
        return TypedResults.Ok(ImportRunDto.From(run));
    }
}
