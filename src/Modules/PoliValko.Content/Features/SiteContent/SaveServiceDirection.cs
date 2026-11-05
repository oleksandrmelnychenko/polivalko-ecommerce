using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Media;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.SiteContent;

internal static class SaveServiceDirection
{
    public static async Task<Results<Ok<ConsoleServiceDirectionDto>, ValidationProblem, ProblemHttpResult>> HandleAsync(
        string code,
        SaveServiceDirectionRequest request,
        PoliValkoDbContext db,
        IAuditLog audit,
        IStorefrontCache storefront,
        CancellationToken ct)
    {
        if (ServiceDirections.Find(code) is not { } direction)
        {
            return Problems.NotFound("content.direction_not_found", "Напрямок не знайдено");
        }

        var errors = new Dictionary<string, string[]>();
        if (request.Description is { Length: > 1000 })
        {
            errors["description"] = ["Опис — до 1000 символів."];
        }

        var imageUrl = SiteContentMapping.Clean(request.ImageUrl);
        if (imageUrl is not null && !ImageUrls.IsValid(imageUrl))
        {
            errors["imageUrl"] = [ImageUrls.InvalidMessage];
        }

        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var content = await db.Set<ServiceDirectionContent>().FirstOrDefaultAsync(d => d.Code == code, ct);
        if (content is null)
        {
            content = new ServiceDirectionContent { Code = code };
            db.Add(content);
        }

        content.Description = SiteContentMapping.Clean(request.Description);
        content.SortOrder = request.SortOrder;
        content.IsVisible = request.IsVisible;
        content.ImageUrl = imageUrl;
        audit.Record("content.service_direction_updated", "ServiceDirection", code, new { content.IsVisible, content.SortOrder, content.ImageUrl });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(["services"], ct);
        return TypedResults.Ok(new ConsoleServiceDirectionDto(code, direction.Name, content.Description, content.SortOrder, content.IsVisible, content.ImageUrl));
    }
}
