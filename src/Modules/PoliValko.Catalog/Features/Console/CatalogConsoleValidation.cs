using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Catalog.Features.Console;

internal static partial class CatalogConsoleValidation
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

    public static async Task<string?> ResolveBrandAsync(
        PoliValkoDbContext db,
        string? requested,
        string? current,
        Dictionary<string, string[]> errors,
        CancellationToken ct)
    {
        var name = NullIfEmpty(requested);
        if (name is null)
        {
            return null;
        }

        var normalized = Brand.Normalize(name);
        var known = await db.Set<Brand>().AsNoTracking().Where(b => b.NormalizedName == normalized).Select(b => b.Name).FirstOrDefaultAsync(ct);
        if (known is not null)
        {
            return known;
        }

        if (current is not null && Brand.Normalize(current) == normalized)
        {
            return current;
        }

        errors["brand"] = [$"Бренду «{name}» немає в довіднику. Спершу додайте його в розділі «Бренди»."];
        return null;
    }

    public static async Task<List<Guid>> ResolveManualLabelsAsync(
        PoliValkoDbContext db,
        IReadOnlyList<Guid>? ids,
        string field,
        Dictionary<string, string[]> errors,
        CancellationToken ct)
    {
        var list = (ids ?? []).Distinct().ToList();
        if (list.Count == 0)
        {
            return list;
        }

        if (list.Count > 20)
        {
            errors[field] = ["Не більше 20 міток."];
            return [];
        }

        var manual = await db.Set<ProductLabel>().AsNoTracking()
            .Where(l => list.Contains(l.Id) && l.Kind == LabelKind.Manual)
            .Select(l => l.Id)
            .ToListAsync(ct);
        if (manual.Count != list.Count)
        {
            errors[field] = ["Мітку не знайдено або вона ставиться автоматично (акція, новинка)."];
            return [];
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
