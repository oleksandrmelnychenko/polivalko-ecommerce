using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Audit;
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

        if (request.Description is { Length: > 1000 })
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["description"] = ["Опис — до 1000 символів."] });
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
        audit.Record("content.service_direction_updated", "ServiceDirection", code, new { content.IsVisible, content.SortOrder });
        await db.SaveChangesAsync(ct);
        await storefront.InvalidateAsync(["services"], ct);
        return TypedResults.Ok(new ConsoleServiceDirectionDto(code, direction.Name, content.Description, content.SortOrder, content.IsVisible));
    }
}
