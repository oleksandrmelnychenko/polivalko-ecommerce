using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace PoliValko.Content.Features.SiteContent;

internal static class SiteContentEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        var group = api.MapGroup(string.Empty).WithTags("Content");

        group.MapGet("/pages/{slug}", GetPage.HandleAsync)
            .WithName("GetPage")
            .WithSummary("Текстова сторінка: оферта, приватність, повернення, доставка й оплата")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/contacts", GetContacts.HandleAsync)
            .WithName("GetContacts")
            .WithSummary("Адреса, графік, телефони магазину й послуг, маршрут і соцмережі");

        return api;
    }
}
