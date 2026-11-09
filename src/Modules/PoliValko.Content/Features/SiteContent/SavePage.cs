using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Text;

namespace PoliValko.Content.Features.SiteContent;

internal static class SavePage
{
    public static async Task<Results<Ok<PageDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string slug,
        SavePageRequest request,
        PoliValkoDbContext db,
        IRichTextSanitizer sanitizer,
        IAuditLog audit,
        IStorefrontCache storefront,
        HttpContext http,
        TimeProvider time,
        CancellationToken ct)
    {
        var page = await db.Set<ContentPage>().FirstOrDefaultAsync(p => p.Slug == slug, ct);
        if (page is null)
        {
            return SiteContentMapping.PageNotFound();
        }

        var errors = new Dictionary<string, string[]>();
        var title = request.Title?.Trim();
        if (string.IsNullOrEmpty(title) || title.Length > 200)
        {
            errors["title"] = ["Вкажіть заголовок до 200 символів."];
        }

        if (request.Lead is { Length: > 500 })
        {
            errors["lead"] = ["Підзаголовок має бути не довшим за 500 символів."];
        }

        var seoTitle = SiteContentMapping.Clean(request.SeoTitle);
        if (seoTitle is { Length: > 200 })
        {
            errors["seoTitle"] = ["SEO-заголовок має бути не довшим за 200 символів."];
        }

        var seoDescription = SiteContentMapping.Clean(request.SeoDescription);
        if (seoDescription is { Length: > 500 })
        {
            errors["seoDescription"] = ["SEO-опис має бути не довшим за 500 символів."];
        }

        var body = sanitizer.Sanitize(request.BodyHtml);
        if (body is { Length: > 100_000 })
        {
            errors["bodyHtml"] = ["Текст завеликий."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        page.Title = title!;
        page.Lead = string.IsNullOrWhiteSpace(request.Lead) ? null : request.Lead.Trim();
        page.BodyHtml = body;
        page.SeoTitle = seoTitle;
        page.SeoDescription = seoDescription;
        page.UpdatedAt = time.GetUtcNow();
        page.UpdatedBy = http.User.StaffName();
        audit.Record("content.page_updated", "Page", slug, new { page.Title, length = body?.Length ?? 0, page.SeoTitle, page.SeoDescription });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync([StorefrontTags.Content, StorefrontTags.Page(slug)], ct);
        return TypedResults.Ok(SiteContentMapping.ToDto(page));
    }
}
