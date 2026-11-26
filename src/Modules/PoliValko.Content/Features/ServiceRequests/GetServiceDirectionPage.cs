using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PoliValko.Content.Domain;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Content.Features.ServiceRequests;

internal static class GetServiceDirectionPage
{
    public static async Task<Results<Ok<ServiceDirectionPageDto>, ProblemHttpResult>> HandleAsync(string slug, PoliValkoDbContext db, CancellationToken ct)
    {
        var content = await db.Set<ServiceDirectionContent>().AsNoTracking().ToDictionaryAsync(d => d.Code, ct);
        var direction = ServiceDirections.All.FirstOrDefault(d => ServiceDirections.SlugOf(d, content.GetValueOrDefault(d.Code)) == slug);
        var page = direction is null ? null : content.GetValueOrDefault(direction.Code);
        if (direction is null || page?.IsVisible == false)
        {
            return Problems.NotFound("content.service_not_found", "Послугу не знайдено");
        }

        return TypedResults.Ok(new ServiceDirectionPageDto(
            direction.Code,
            slug,
            direction.Name,
            page?.Description,
            page?.ImageUrl,
            page?.BodyHtml,
            page?.SeoTitle,
            page?.SeoDescription,
            page?.UpdatedAt));
    }
}
