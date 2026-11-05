using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Catalog.Features.Console.Labels;

internal static class LabelEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder catalog)
    {
        var labels = catalog.MapGroup("/labels").RequireStaff();
        labels.MapGet(string.Empty, ListLabels.HandleAsync)
            .RequirePermission(PermissionKeys.ProductsView, PermissionKeys.LabelsManage)
            .WithName("ConsoleListLabels")
            .WithSummary("Мітки товарів у порядку показу: ручні та автоматичні (акція — стара ціна більша, новинка — створений за N днів)");
        labels.MapPost(string.Empty, CreateLabel.HandleAsync)
            .RequirePermission(PermissionKeys.LabelsManage)
            .WithName("ConsoleCreateLabel")
            .WithSummary("Нова мітка");
        labels.MapPut("/{id:guid}", UpdateLabel.HandleAsync)
            .RequirePermission(PermissionKeys.LabelsManage)
            .WithName("ConsoleUpdateLabel")
            .WithSummary("Зміна мітки: назва, колір, порядок, увімкнення; тип не змінюється")
            .ProducesProblem(StatusCodes.Status404NotFound);
        labels.MapDelete("/{id:guid}", DeleteLabel.HandleAsync)
            .RequirePermission(PermissionKeys.LabelsManage)
            .WithName("ConsoleDeleteLabel")
            .WithSummary("Видалення ручної мітки або вимкненої автоматичної")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return catalog;
    }
}
