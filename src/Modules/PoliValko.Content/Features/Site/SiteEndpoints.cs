using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace PoliValko.Content.Features.Site;

internal static class SiteEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        api.MapGroup("/site").WithTags("Content")
            .MapGet("/home", GetSiteHome.HandleAsync)
            .WithName("GetSiteHome")
            .WithSummary("Головна сторінка: оголошення (якщо діє зараз), порядок і видимість блоків, тексти переваг, кроків і блоку магазину, банери, що діють зараз");

        return api;
    }
}
