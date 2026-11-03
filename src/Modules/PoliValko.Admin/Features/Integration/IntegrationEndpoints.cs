using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Admin.Features.Audit;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Admin.Features.Integration;

internal static class IntegrationEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        var staff = admin.MapGroup("/integration").WithTags("Admin").RequireStaff();
        staff.MapGet("/status", GetIntegrationStatus.HandleAsync)
            .WithName("AdminIntegrationStatus")
            .WithSummary("Фонові завдання, свіжість даних каталогу й черга операцій");
        staff.MapGet("/runs", ListSyncRuns.HandleAsync)
            .WithName("AdminListSyncRuns")
            .WithSummary("Останні запуски завдань зі звітом помилок");

        var adminOnly = admin.MapGroup("/integration").WithTags("Admin").RequireStaff(StaffPolicies.Admin);
        adminOnly.MapPost("/jobs/{job}/run", RequestJobRun.HandleAsync)
            .WithName("AdminRunSyncJob")
            .WithSummary("Запустити завдання поза розкладом (виконає Worker протягом хвилини)")
            .ProducesProblem(StatusCodes.Status404NotFound);
        adminOnly.MapGet("/outbox", ListOutbox.HandleAsync)
            .WithName("AdminListOutbox")
            .WithSummary("Невдалі й відкладені операції черги");
        adminOnly.MapPost("/outbox/{id:guid}/retry", RetryOutboxMessage.HandleAsync)
            .WithName("AdminRetryOutboxMessage")
            .WithSummary("Ручний повтор невдалої операції")
            .ProducesProblem(StatusCodes.Status404NotFound);

        admin.MapGroup("/audit").WithTags("Admin").RequireStaff(StaffPolicies.Admin)
            .MapGet(string.Empty, ListAudit.HandleAsync)
            .WithName("AdminListAudit")
            .WithSummary("Журнал змін: доступи, статуси замовлень, повернення, каталог і налаштування");

        return admin;
    }
}
