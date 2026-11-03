using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Catalog.Features.Admin.Redirects;

internal static class RedirectEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var redirects = catalog.MapGroup("/redirects").RequireStaff(StaffPolicies.Admin);
        redirects.MapGet(string.Empty, ListRedirects.HandleAsync)
            .WithName("AdminListRedirects")
            .WithSummary("Постійні перенаправлення зі старих адрес");
        redirects.MapPost(string.Empty, CreateRedirect.HandleAsync)
            .WithName("AdminCreateRedirect")
            .WithSummary("Ручне перенаправлення");
        redirects.MapDelete("/{id:guid}", DeleteRedirect.HandleAsync)
            .WithName("AdminDeleteRedirect")
            .WithSummary("Видалення перенаправлення")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return catalog;
    }
}
