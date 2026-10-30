using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PoliValko.Delivery.NovaPoshta;
using PoliValko.Delivery.Persistence;
using PoliValko.Infrastructure;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Delivery;

public sealed record SettlementDto(string Ref, string Name, string Area);

public sealed record WarehouseDto(string Ref, int Number, string Name, string Address, WarehouseType Type);

public sealed record PickupPointDto(string Code, string Name, string Address, string Schedule, string Instructions, string? MapUrl);

public static class DeliveryModule
{
    public static IServiceCollection AddDeliveryModule(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<NovaPoshtaOptions>().BindConfiguration(NovaPoshtaOptions.Section);
        services.AddMemoryCache();
        services.AddModelConfigurator<DeliveryModelConfigurator>();

        services.AddScoped<PickupPointStore>();
        services.AddScoped<DemoNovaPoshtaDirectory>();
        services.AddScoped<NovaPoshtaDbDirectory>();

        // Режим обирається під час створення (на запит), а не під час реєстрації: так ключ API
        // можна задати будь-яким джерелом налаштувань, зокрема в тестах.
        services.AddScoped<IDeliveryDirectory>(provider =>
            provider.GetRequiredService<IOptions<NovaPoshtaOptions>>().Value.IsConfigured
                ? provider.GetRequiredService<NovaPoshtaDbDirectory>()
                : provider.GetRequiredService<DemoNovaPoshtaDirectory>());

        services.AddHttpClient<NovaPoshtaClient>((provider, http) =>
        {
            var options = provider.GetRequiredService<IOptions<NovaPoshtaOptions>>().Value;
            http.BaseAddress = new Uri(options.BaseUrl);
            http.Timeout = options.Timeout;
        });
        services.AddScoped<NovaPoshtaDirectorySync>();
        return services;
    }

    /// <summary>Фонові завдання модуля (синхронізація довідника Нової пошти). Лише в хості Worker.</summary>
    public static IServiceCollection AddDeliveryJobs(this IServiceCollection services)
    {
        services.AddHostedService<NovaPoshtaSyncJob>();
        return services;
    }

    /// <summary>Адмінка: точки самовивозу й стан довідника Нової пошти (лише адміністратор).</summary>
    public static RouteGroupBuilder MapAdminDeliveryEndpoints(this RouteGroupBuilder admin)
    {
        AdminDeliveryEndpoints.Map(admin);
        return admin;
    }

    public static IEndpointRouteBuilder MapDeliveryEndpoints(this IEndpointRouteBuilder api)
    {
        var group = api.MapGroup("/delivery").WithTags("Delivery");

        group.MapGet("/np/settlements", SearchSettlementsAsync)
            .WithName("SearchNovaPoshtaSettlements")
            .WithSummary("Населені пункти Нової пошти (від 2 символів; без запиту — популярні)");

        group.MapGet("/np/warehouses", GetWarehousesAsync)
            .WithName("GetNovaPoshtaWarehouses")
            .WithSummary("Відділення й поштомати в населеному пункті")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapGet("/pickup-points", GetPickupPointsAsync)
            .WithName("GetPickupPoints")
            .WithSummary("Точки самовивозу: адреса, графік роботи, інструкція покупцю");

        return api;
    }

    private static async Task<Ok<List<SettlementDto>>> SearchSettlementsAsync(string? q, IDeliveryDirectory directory, CancellationToken ct)
    {
        var settlements = await directory.SearchSettlementsAsync(q, 20, ct);
        return TypedResults.Ok(settlements.Select(s => new SettlementDto(s.Ref, s.Name, s.Area)).ToList());
    }

    private static async Task<Results<Ok<List<WarehouseDto>>, ValidationProblem, ProblemHttpResult>> GetWarehousesAsync(
        string? settlementRef,
        string? q,
        IDeliveryDirectory directory,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(settlementRef))
        {
            return TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["settlementRef"] = ["Оберіть населений пункт."],
            });
        }

        var warehouses = await directory.GetWarehousesAsync(settlementRef, q, ct);
        if (warehouses is null)
        {
            return Problems.NotFound("delivery.settlement_not_found", "Населений пункт не знайдено", "Оберіть населений пункт зі списку.");
        }

        return TypedResults.Ok(warehouses.Select(w => new WarehouseDto(w.Ref, w.Number, w.Name, w.Address, w.Type)).ToList());
    }

    private static async Task<Ok<List<PickupPointDto>>> GetPickupPointsAsync(PickupPointStore store, CancellationToken ct)
    {
        var points = await store.GetActiveAsync(ct);
        return TypedResults.Ok(points.Select(p => new PickupPointDto(p.Code, p.Name, p.Address, p.Schedule, p.Instructions, p.MapUrl)).ToList());
    }
}
