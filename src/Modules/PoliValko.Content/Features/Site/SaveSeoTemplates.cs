using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Content.Features.Site;

internal static class SaveSeoTemplates
{
    public static async Task<Results<Ok<SeoTemplatesDto>, ValidationProblem>> HandleAsync(
        SeoTemplatesDto request,
        ISettingsStore settings,
        IAuditLog audit,
        IStorefrontCache storefront,
        HttpContext http,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var product = Check(errors, "product", request.Product, SeoTemplateSettings.ProductTokens);
        var category = Check(errors, "category", request.Category, SeoTemplateSettings.CategoryTokens);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var value = new SeoTemplatesDto(product, category);
        var before = await SeoTemplateSettings.LoadAsync(settings, ct);
        audit.Record("site.seo_templates_updated", "SeoTemplates", null, new { before, after = value });
        await settings.SaveAsync(SeoTemplateSettings.SettingsKey, value, http.User.StaffName(), ct);
        await storefront.InvalidateAsync([StorefrontTags.Catalog, StorefrontTags.Products, StorefrontTags.Categories], ct);
        return TypedResults.Ok(value);
    }

    private static SeoTemplateDto Check(Dictionary<string, string[]> errors, string prefix, SeoTemplateDto? pair, IReadOnlyList<string> tokens)
    {
        var title = pair?.Title?.Trim() ?? string.Empty;
        var description = pair?.Description?.Trim() ?? string.Empty;
        if (title.Length == 0)
        {
            errors[$"{prefix}.title"] = ["Вкажіть шаблон."];
        }

        Field(errors, $"{prefix}.title", title, tokens);
        Field(errors, $"{prefix}.description", description, tokens);
        return new SeoTemplateDto(title, description);
    }

    private static void Field(Dictionary<string, string[]> errors, string field, string template, IReadOnlyList<string> tokens)
    {
        if (template.Length > SeoTemplateSettings.MaxLength)
        {
            errors[field] = [$"Шаблон має бути не довшим за {SeoTemplateSettings.MaxLength} символів."];
            return;
        }

        var unknown = SeoTemplateSettings.UnknownTokens(template, tokens).ToList();
        if (unknown.Count > 0)
        {
            errors[field] = [$"Невідомі змінні: {string.Join(", ", unknown)}."];
        }
    }
}
