using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Console.Features.Audit;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Console.Features.Integration;

internal static class IntegrationEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var staff = console.MapGroup("/integration").WithTags("Console").RequireStaff();
        staff.MapGet("/status", GetIntegrationStatus.HandleAsync)
            .WithName("ConsoleIntegrationStatus")
            .WithSummary("Фонові завдання, свіжість даних каталогу й черга операцій");
        staff.MapGet("/runs", ListSyncRuns.HandleAsync)
            .WithName("ConsoleListSyncRuns")
            .WithSummary("Останні запуски завдань зі звітом помилок");

        var adminOnly = console.MapGroup("/integration").WithTags("Console").RequireStaff(StaffPolicies.Admin);
        adminOnly.MapPost("/jobs/{job}/run", RequestJobRun.HandleAsync)
            .WithName("ConsoleRunSyncJob")
            .WithSummary("Запустити завдання поза розкладом (виконає Worker протягом хвилини)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        adminOnly.MapGet("/outbox", ListOutbox.HandleAsync)
            .WithName("ConsoleListOutbox")
            .WithSummary("Невдалі й відкладені операції черги");
        adminOnly.MapPost("/outbox/{id:guid}/retry", RetryOutboxMessage.HandleAsync)
            .WithName("ConsoleRetryOutboxMessage")
            .WithSummary("Ручний повтор невдалої операції")
            .ProducesProblem(StatusCodes.Status404NotFound);

        console.MapGroup("/audit").WithTags("Console").RequireStaff(StaffPolicies.Admin)
            .MapGet(string.Empty, ListAudit.HandleAsync)
            .WithName("ConsoleListAudit")
            .WithSummary("Журнал змін: доступи, статуси замовлень, повернення, каталог і налаштування");

        return console;
    }
}
