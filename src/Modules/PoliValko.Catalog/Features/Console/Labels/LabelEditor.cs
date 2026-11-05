using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Catalog.Features.Console.Labels;

internal static class LabelEditor
{
    public const int MaxNameLength = 30;

    public static readonly string[] StorefrontTagsToInvalidate = [StorefrontTags.Catalog, StorefrontTags.Products, StorefrontTags.Collections];

    public static Dictionary<string, string[]> Apply(ProductLabel label, SaveLabelRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        var name = request.Name?.Trim();
        if (string.IsNullOrEmpty(name) || name.Length > MaxNameLength)
        {
            errors["name"] = [$"Вкажіть назву до {MaxNameLength} символів."];
        }

        if (request.Tone is null)
        {
            errors["tone"] = ["Оберіть колір мітки."];
        }

        if (request.Kind is { } kind && kind != label.Kind)
        {
            errors["kind"] = ["Тип мітки не змінюється. Створіть нову мітку."];
        }

        if (label.Kind == LabelKind.New && request.NewDays is not (>= 1 and <= 365))
        {
            errors["newDays"] = ["Вкажіть, скільки днів товар вважається новинкою: від 1 до 365."];
        }

        if (errors.Count > 0)
        {
            return errors;
        }

        label.Name = name!;
        label.Tone = request.Tone!.Value;
        label.NewDays = label.Kind == LabelKind.New ? request.NewDays : null;
        label.SortOrder = request.SortOrder;
        label.IsActive = request.IsActive;
        return errors;
    }

    public static async Task<int> CountProductsAsync(PoliValkoDbContext db, ProductLabel label, DateTimeOffset now, CancellationToken ct) =>
        await db.Set<Product>().WithLabel(db, label, now).CountAsync(ct);

    public static async Task<LabelDto> ToDtoAsync(PoliValkoDbContext db, ProductLabel label, DateTimeOffset now, CancellationToken ct) =>
        ToDto(label, await CountProductsAsync(db, label, now, ct));

    public static LabelDto ToDto(ProductLabel l, int productCount) =>
        new(l.Id, l.Name, l.Tone, l.Kind, l.NewDays, l.SortOrder, l.IsActive, productCount);

    public static ProblemHttpResult NotFound() => Problems.NotFound("catalog.label_not_found", "Мітку не знайдено");
}
