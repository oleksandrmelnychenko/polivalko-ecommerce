using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Text;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.SiteContent;

internal static partial class SaveServiceDirection
{
    public static async Task<Results<Ok<ConsoleServiceDirectionDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string code,
        SaveServiceDirectionRequest request,
        PoliValkoDbContext db,
        IRichTextSanitizer sanitizer,
        IAuditLog audit,
        IStorefrontCache storefront,
        TimeProvider time,
        CancellationToken ct)
    {
        if (ServiceDirections.Find(code) is not { } direction)
        {
            return Problems.NotFound("content.direction_not_found", "Напрямок не знайдено");
        }

        var all = await db.Set<ServiceDirectionContent>().ToDictionaryAsync(d => d.Code, ct);
        var content = all.GetValueOrDefault(code);
        var previousSlug = ServiceDirections.SlugOf(direction, content);

        var errors = new Dictionary<string, string[]>();
        if (request.Description is { Length: > 1000 })
        {
            errors["description"] = ["Опис має бути не довшим за 1000 символів."];
        }

        var imageUrl = SiteContentMapping.Clean(request.ImageUrl);
        if (imageUrl is not null && !ImageUrls.IsValid(imageUrl))
        {
            errors["imageUrl"] = [ImageUrls.InvalidMessage];
        }

        // Null keeps the saved value; an empty slug goes back to the default address.
        var slug = request.Slug is null ? content?.Slug : SiteContentMapping.Clean(request.Slug)?.ToLowerInvariant();
        if (slug == direction.Slug)
        {
            slug = null;
        }

        if (slug is not null)
        {
            if (slug.Length > ServiceDirectionContent.SlugLength || !SlugPattern().IsMatch(slug))
            {
                errors["slug"] = ["Адреса: малі латинські літери, цифри й дефіси, до 100 символів (напр. montazh-avtopolyvu)."];
            }
            else if (ServiceDirections.All.Any(d => d.Code != code && ServiceDirections.SlugOf(d, all.GetValueOrDefault(d.Code)) == slug))
            {
                errors["slug"] = ["Цю адресу вже має інша послуга."];
            }
        }

        var seoTitle = request.SeoTitle is null ? content?.SeoTitle : SiteContentMapping.Clean(request.SeoTitle);
        if (seoTitle is { Length: > 200 })
        {
            errors["seoTitle"] = ["SEO-заголовок має бути не довшим за 200 символів."];
        }

        var seoDescription = request.SeoDescription is null ? content?.SeoDescription : SiteContentMapping.Clean(request.SeoDescription);
        if (seoDescription is { Length: > 500 })
        {
            errors["seoDescription"] = ["SEO-опис має бути не довшим за 500 символів."];
        }

        var body = request.BodyHtml is null ? content?.BodyHtml : sanitizer.Sanitize(request.BodyHtml);
        if (body is { Length: > 100_000 })
        {
            errors["bodyHtml"] = ["Текст завеликий."];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        if (content is null)
        {
            content = new ServiceDirectionContent { Code = code };
            db.Add(content);
        }

        content.Description = SiteContentMapping.Clean(request.Description);
        content.SortOrder = request.SortOrder;
        content.IsVisible = request.IsVisible;
        content.ImageUrl = imageUrl;
        content.Slug = slug;
        content.BodyHtml = string.IsNullOrWhiteSpace(body) ? null : body;
        content.SeoTitle = seoTitle;
        content.SeoDescription = seoDescription;
        content.UpdatedAt = time.GetUtcNow();
        var currentSlug = ServiceDirections.SlugOf(direction, content);
        audit.Record("content.service_direction_updated", "ServiceDirection", code, new
        {
            content.IsVisible,
            content.SortOrder,
            content.ImageUrl,
            slug = currentSlug,
            bodyLength = content.BodyHtml?.Length ?? 0,
            content.SeoTitle,
            content.SeoDescription,
        });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(["services", ServicePageTag(previousSlug), ServicePageTag(currentSlug)], ct);
        return TypedResults.Ok(ListServiceDirections.ToDto(direction, content, content.SortOrder));
    }

    public static string ServicePageTag(string slug) => $"service:{slug}";

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex SlugPattern();
}
