using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Console.Features.Audit;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Console.Features.Integration;

internal static class IntegrationEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var staff = console.MapGroup("/integration").WithTags("Console").RequireStaff(PermissionKeys.IntegrationStatusView);
        staff.MapGet("/status", GetIntegrationStatus.HandleAsync)
            .WithName("ConsoleIntegrationStatus")
            .WithSummary("Фонові завдання, свіжість даних каталогу й черга операцій");
        staff.MapGet("/runs", ListSyncRuns.HandleAsync)
            .WithName("ConsoleListSyncRuns")
            .WithSummary("Останні запуски завдань зі звітом помилок");

        var operations = console.MapGroup("/integration").WithTags("Console").RequireStaff();
        operations.MapPost("/jobs/{job}/run", RequestJobRun.HandleAsync)
            .RequirePermission(PermissionKeys.IntegrationJobsRun)
            .WithName("ConsoleRunSyncJob")
            .WithSummary("Запустити завдання поза розкладом (виконає Worker протягом хвилини)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        operations.MapGet("/outbox", ListOutbox.HandleAsync)
            .RequirePermission(PermissionKeys.IntegrationOutboxManage)
            .WithName("ConsoleListOutbox")
            .WithSummary("Невдалі й відкладені операції черги");
        operations.MapPost("/outbox/{id:guid}/retry", RetryOutboxMessage.HandleAsync)
            .RequirePermission(PermissionKeys.IntegrationOutboxManage)
            .WithName("ConsoleRetryOutboxMessage")
            .WithSummary("Ручний повтор невдалої операції")
            .ProducesProblem(StatusCodes.Status404NotFound);

        console.MapGroup("/audit").WithTags("Console").RequireStaff(PermissionKeys.AuditView)
            .MapGet(string.Empty, ListAudit.HandleAsync)
            .WithName("ConsoleListAudit")
            .WithSummary("Журнал змін: доступи, статуси замовлень, повернення, каталог і налаштування");

        return console;
    }
}
