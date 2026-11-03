using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Navkolo.Features.CatalogImport;

internal static class CatalogImportEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        admin.MapGroup("/integration/navkolo").WithTags("Admin").RequireStaff(StaffPolicies.Admin)
            .MapPost("/import", ImportCatalogFile.HandleAsync)
            .DisableAntiforgery()
            .WithName("AdminImportCatalog")
            .WithSummary("Імпорт каталогу з файлу JSON або CSV зі звітом помилок")
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return admin;
    }
}
