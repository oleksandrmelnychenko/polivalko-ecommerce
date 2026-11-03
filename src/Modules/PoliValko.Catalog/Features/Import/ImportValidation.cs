using PoliValko.Catalog.Contracts;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.Catalog.Features.Import;

internal static class ImportValidation
{
    public static List<NavkoloProductRecord> Validate(IReadOnlyList<NavkoloProductRecord> records, List<SyncError> errors)
    {
        var valid = new List<NavkoloProductRecord>(records.Count);
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var skus = new Dictionary<string, string>(StringComparer.Ordinal);

        for (var i = 0; i < records.Count; i++)
        {
            var r = records[i] with
            {
                NavkoloId = TrimOrNull(records[i].NavkoloId),
                Sku = TrimOrNull(records[i].Sku),
                Name = TrimOrNull(records[i].Name),
                GroupRef = TrimOrNull(records[i].GroupRef),
            };
            var label = r.Sku ?? r.NavkoloId ?? $"рядок {i + 1}";
            var problem = r switch
            {
                { NavkoloId: null } => "Немає ідентифікатора Navkolo.",
                { Sku: null } => "Немає артикула.",
                { Name: null } => "Немає назви.",
                { GroupRef: null } => "Немає групи товарів.",
                { Price: null or < 0m } => "Ціна має бути невід'ємним числом.",
                { Stock: < 0m } => "Залишок не може бути від'ємним.",
                { NavkoloId.Length: > 100 } or { Sku.Length: > 100 } or { GroupRef.Length: > 100 } => "Ідентифікатор, артикул або група довші за 100 символів.",
                { Name.Length: > 500 } => "Назва довша за 500 символів.",
                _ when !ids.Add(r.NavkoloId!) => "Дублікат ідентифікатора Navkolo у файлі.",
                _ when skus.TryGetValue(r.Sku!, out var other) && other != r.NavkoloId => "Дублікат артикула у файлі.",
                _ => null,
            };

            if (problem is not null)
            {
                errors.Add(new SyncError(label, problem));
                continue;
            }

            skus[r.Sku!] = r.NavkoloId!;
            valid.Add(r);
        }

        return valid;

        static string? TrimOrNull(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
