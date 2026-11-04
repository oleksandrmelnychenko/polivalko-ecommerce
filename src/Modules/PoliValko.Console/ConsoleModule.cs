using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Console.Features.Dashboard;
using PoliValko.Console.Features.Integration;
using PoliValko.Console.Features.Search;
using PoliValko.Console.Features.Summary;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Console;

public static class ConsoleModule
{
    public static IServiceCollection AddConsoleModule(this IServiceCollection services, IConfiguration configuration) =>
        services;

    public static RouteGroupBuilder MapConsoleSummaryEndpoints(this RouteGroupBuilder console)
    {
        console.MapGroup("/summary").WithTags("Console").RequireStaff()
            .MapGet(string.Empty, GetConsoleSummary.HandleAsync)
            .WithName("ConsoleSummary")
            .WithSummary("Нові замовлення, очікують оплати чи підтвердження, заявки, повернення, збої інтеграцій");
        return console;
    }

    public static RouteGroupBuilder MapConsoleDashboardEndpoints(this RouteGroupBuilder console)
    {
        console.MapGroup("/dashboard").WithTags("Console").RequireStaff()
            .MapGet(string.Empty, GetConsoleDashboard.HandleAsync)
            .WithName("ConsoleDashboard")
            .WithSummary("Виручка, замовлення, середній чек і покупці за 7, 30 чи 90 днів із порівнянням, динаміка по днях, топ товарів, залишки");
        return console;
    }

    public static RouteGroupBuilder MapConsoleSearchEndpoints(this RouteGroupBuilder console)
    {
        console.MapGroup("/search").WithTags("Console").RequireStaff()
            .MapGet(string.Empty, SearchConsole.HandleAsync)
            .WithName("ConsoleSearch")
            .WithSummary("Пошук по замовленнях (номер, телефон), товарах (назва, артикул) і покупцях (ім'я, телефон); від 2 символів");
        return console;
    }

    public static RouteGroupBuilder MapConsoleIntegrationEndpoints(this RouteGroupBuilder console) =>
        IntegrationEndpoints.Map(console);
}
