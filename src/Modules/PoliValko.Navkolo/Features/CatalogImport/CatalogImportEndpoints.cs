using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Navkolo.Features.CatalogImport;

internal static class CatalogImportEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        console.MapGroup("/integration/navkolo").WithTags("Console").RequireStaff(PermissionKeys.CatalogImportRun)
            .MapPost("/import", ImportCatalogFile.HandleAsync)
            .DisableAntiforgery()
            .WithName("ConsoleImportCatalog")
            .WithSummary("Імпорт каталогу з файлу JSON або CSV зі звітом помилок")
            .ProducesProblem(StatusCodes.Status400BadRequest);
        return console;
    }
}
