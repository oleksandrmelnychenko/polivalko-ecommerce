using System.Text.RegularExpressions;
using PoliValko.Catalog.Contracts;

namespace PoliValko.Catalog.Features.Admin;

internal static partial class CatalogAdminValidation
{
    public static List<ProductAttributeDto> ValidateAttributes(IReadOnlyList<ProductAttributeDto>? attributes, Dictionary<string, string[]> errors)
    {
        var list = (attributes ?? [])
            .Select(a => new ProductAttributeDto(a.Name?.Trim() ?? string.Empty, a.Value?.Trim() ?? string.Empty))
            .Where(a => a.Name.Length > 0 || a.Value.Length > 0)
            .ToList();
        if (list.Count > 50)
        {
            errors["attributes"] = ["Не більше 50 характеристик."];
        }
        else if (list.Any(a => a.Name.Length is 0 or > 100 || a.Value.Length is 0 or > 300))
        {
            errors["attributes"] = ["У кожної характеристики має бути назва до 100 символів і значення до 300."];
        }
        else if (list.Select(a => a.Name).Distinct(StringComparer.OrdinalIgnoreCase).Count() != list.Count)
        {
            errors["attributes"] = ["Назви характеристик не повинні повторюватися."];
        }

        return list;
    }

    public static void CheckLength(Dictionary<string, string[]> errors, string field, string? value, int max)
    {
        if (value is { } v && v.Trim().Length > max)
        {
            errors[field] = [$"Не більше {max} символів."];
        }
    }

    public static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static bool IsSlug(string value) => SlugPattern().IsMatch(value);

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();
}
