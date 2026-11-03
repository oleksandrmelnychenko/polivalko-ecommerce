using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Admin.Features.Dashboard;
using PoliValko.Admin.Features.Integration;
using PoliValko.Admin.Features.Search;
using PoliValko.Admin.Features.Summary;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Admin;

public static class AdminModule
{
    public static IServiceCollection AddAdminModule(this IServiceCollection services, IConfiguration configuration) =>
        services;

    public static RouteGroupBuilder MapAdminSummaryEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/summary").WithTags("Admin").RequireStaff()
            .MapGet(string.Empty, GetAdminSummary.HandleAsync)
            .WithName("AdminSummary")
            .WithSummary("Нові замовлення, очікують оплати чи підтвердження, заявки, повернення, збої інтеграцій");
        return admin;
    }

    public static RouteGroupBuilder MapAdminDashboardEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/dashboard").WithTags("Admin").RequireStaff()
            .MapGet(string.Empty, GetAdminDashboard.HandleAsync)
            .WithName("AdminDashboard")
            .WithSummary("Виручка, замовлення, середній чек і покупці за 7, 30 чи 90 днів із порівнянням, динаміка по днях, топ товарів, залишки");
        return admin;
    }

    public static RouteGroupBuilder MapAdminSearchEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGroup("/search").WithTags("Admin").RequireStaff()
            .MapGet(string.Empty, SearchAdmin.HandleAsync)
            .WithName("AdminSearch")
            .WithSummary("Пошук по замовленнях (номер, телефон), товарах (назва, артикул) і покупцях (ім'я, телефон); від 2 символів");
        return admin;
    }

    public static RouteGroupBuilder MapAdminIntegrationEndpoints(this RouteGroupBuilder admin) =>
        IntegrationEndpoints.Map(admin);
}
