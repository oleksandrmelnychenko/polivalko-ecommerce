using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Delivery.Contracts;
using PoliValko.Delivery.Domain;
using PoliValko.Delivery.Features.Console;
using PoliValko.Delivery.Features.DirectorySync;
using PoliValko.Delivery.Features.Storefront;
using PoliValko.Delivery.Integrations.NovaPoshta;
using PoliValko.Delivery.Jobs;
using PoliValko.Identity.Features.Auth;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Sync;

namespace PoliValko.IntegrationTests;

public sealed class DeliveryApiTests(ApiFactory api)
{
    private const string StoreCode = "bucha-store";
    private const string StoreUrl = $"/api/v1/console/delivery/pickup-points/{StoreCode}";
    private const string StoreName = "Магазин Poli Valko у Бучі";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Public_pickup_points_come_from_database()
    {
        var points = await api.CreateClient().GetFromJsonAsync<List<PickupPointDto>>("/api/v1/delivery/pickup-points", TestJson.Options, Ct);

        var store = points!.ShouldHaveSingleItem();
        store.Code.ShouldBe(StoreCode);
        store.Name.ShouldBe(StoreName);
        store.Address.ShouldNotBeNullOrWhiteSpace();
        store.Schedule.ShouldNotBeNullOrWhiteSpace();
        store.Instructions.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Admin_updates_pickup_point_with_csrf_and_change_is_audited()
    {
        var admin = await LoginAsync(api, ApiFactory.AdminEmail);
        var original = (await admin.GetFromJsonAsync<List<ConsolePickupPointDto>>("/api/v1/console/delivery/pickup-points", TestJson.Options, Ct))!
            .Single(p => p.Code == StoreCode);
        var update = new UpdatePickupPointRequest(
            original.Name,
            original.Address,
            "Пн–Сб, 8:00–20:00",
            "Покажіть номер замовлення на касі.",
            "https://maps.example.com/bucha-store",
            true);

        var withoutCsrf = await admin.PutAsJsonAsync(StoreUrl, update, Ct);
        withoutCsrf.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await withoutCsrf.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.csrf_invalid");

        await AddCsrfAsync(admin);
        try
        {
            var response = await admin.PutAsJsonAsync(StoreUrl, update, Ct);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            var updated = (await response.Content.ReadFromJsonAsync<ConsolePickupPointDto>(TestJson.Options, Ct))!;
            updated.Schedule.ShouldBe("Пн–Сб, 8:00–20:00");
            updated.MapUrl.ShouldBe("https://maps.example.com/bucha-store");

            var store = (await api.CreateClient().GetFromJsonAsync<List<PickupPointDto>>("/api/v1/delivery/pickup-points", TestJson.Options, Ct))!
                .ShouldHaveSingleItem();
            store.Schedule.ShouldBe("Пн–Сб, 8:00–20:00");
            store.Instructions.ShouldBe("Покажіть номер замовлення на касі.");
            store.MapUrl.ShouldBe("https://maps.example.com/bucha-store");

            var entry = await api.WithDbAsync(db => db.Set<AuditEntry>()
                .Where(e => e.Action == "delivery.pickup_point_updated" && e.EntityId == StoreCode)
                .OrderByDescending(e => e.At)
                .FirstAsync(Ct));
            entry.Actor.ShouldBe("Адмін Тестовий");
            entry.EntityType.ShouldBe("PickupPoint");
            using var details = JsonDocument.Parse(entry.Details!);
            var before = details.RootElement.GetProperty("before");
            var after = details.RootElement.GetProperty("after");
            before.GetProperty("schedule").GetString().ShouldBe(original.Schedule);
            after.GetProperty("schedule").GetString().ShouldBe("Пн–Сб, 8:00–20:00");
            after.GetProperty("mapUrl").GetString().ShouldBe("https://maps.example.com/bucha-store");
        }
        finally
        {
            await admin.PutAsJsonAsync(
                StoreUrl,
                new UpdatePickupPointRequest(original.Name, original.Address, original.Schedule, original.Instructions, original.MapUrl, original.IsActive),
                Ct);
        }
    }

    [Fact]
    public async Task Manager_cannot_change_delivery_settings()
    {
        var manager = await LoginAsync(api, ApiFactory.ManagerEmail);
        await AddCsrfAsync(manager);

        var update = await manager.PutAsJsonAsync(StoreUrl, await CurrentStoreAsRequestAsync(), Ct);
        update.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await update.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("auth.forbidden");

        (await manager.GetAsync("/api/v1/console/delivery/pickup-points", Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.GetAsync("/api/v1/console/delivery/novaposhta", Ct)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Invalid_update_last_active_point_and_unknown_code_are_rejected()
    {
        var admin = await LoginAsync(api, ApiFactory.AdminEmail);
        await AddCsrfAsync(admin);

        var invalid = await admin.PutAsJsonAsync(StoreUrl, new UpdatePickupPointRequest("", " ", null, "", "ftp://maps", null), Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct);
        problem!.Code.ShouldBe("validation.failed");
        problem.Errors!.Keys.ShouldBe(["name", "address", "schedule", "instructions", "mapUrl", "isActive"], ignoreOrder: true);

        var current = await CurrentStoreAsRequestAsync();
        var deactivate = await admin.PutAsJsonAsync(StoreUrl, current with { IsActive = false }, Ct);
        deactivate.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await deactivate.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["isActive"]);

        var missing = await admin.PutAsJsonAsync("/api/v1/console/delivery/pickup-points/no-such-point", current, Ct);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await missing.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("delivery.pickup_point_not_found");
    }

    [Fact]
    public async Task Without_api_key_directory_runs_in_demo_mode()
    {
        var admin = await LoginAsync(api, ApiFactory.AdminEmail);

        var status = await admin.GetFromJsonAsync<NovaPoshtaStatusDto>("/api/v1/console/delivery/novaposhta", TestJson.Options, Ct);

        status!.Mode.ShouldBe("demo");
        status.Sync.ShouldNotBeNull();
    }

    [Fact]
    public async Task Sync_fills_local_copy_and_deactivates_missing_warehouses()
    {
        const string cityRef = "it-city-testohrad";
        var stub = new NovaPoshtaStub();
        stub.Cities.Add(new JsonObject { ["Ref"] = cityRef, ["Description"] = "Тестоград", ["Area"] = NovaPoshtaStub.AreaRef });
        stub.Warehouses.AddRange(
        [
            NovaPoshtaStub.Warehouse("it-w-2", cityRef, "Відділення №2: вул. Вокзальна, 61", "2", "Branch"),
            NovaPoshtaStub.Warehouse("it-w-1", cityRef, "Відділення №1: вул. Енергетиків, 4", "1", "Branch"),
            NovaPoshtaStub.Warehouse("it-p-31008", cityRef, "Поштомат \"Нова Пошта\" №31008: вул. Нове Шосе, 8", "31008", "Postomat"),
            NovaPoshtaStub.Warehouse("it-w-closed", cityRef, "Відділення №3: вул. Закрита, 1", "3", "Branch", status: "Closed"),
        ]);

        await using var factory = api.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Delivery:NovaPoshta:ApiKey", NovaPoshtaStub.ApiKey);
            builder.UseSetting("Delivery:NovaPoshta:PageDelay", "00:00:00");
            builder.UseSetting("Delivery:NovaPoshta:RetryDelay", "00:00:00");
            builder.ConfigureServices(services =>
                services.AddHttpClient<NovaPoshtaClient>().ConfigurePrimaryHttpMessageHandler(() => stub));
        });
        var client = factory.CreateClient();

        var first = await SyncAsync(factory);
        first.Status.ShouldBe(SyncRunStatus.Succeeded, first.Summary);

        var found = await client.GetFromJsonAsync<List<SettlementDto>>("/api/v1/delivery/np/settlements?q=тестогр", TestJson.Options, Ct);
        found!.ShouldHaveSingleItem().ShouldBe(new SettlementDto(cityRef, "Тестоград", "Київська обл."));
        var popular = await client.GetFromJsonAsync<List<SettlementDto>>("/api/v1/delivery/np/settlements", TestJson.Options, Ct);
        popular!.Select(s => s.Ref).ShouldContain(cityRef);
        (await client.GetFromJsonAsync<List<SettlementDto>>("/api/v1/delivery/np/settlements?q=те", TestJson.Options, Ct))!
            .Select(s => s.Ref).ShouldContain(cityRef);

        var warehouses = await WarehousesAsync(client, cityRef);
        warehouses.Select(w => w.Ref).ShouldBe(["it-w-1", "it-w-2", "it-p-31008"]);
        warehouses[2].Type.ShouldBe(WarehouseType.Postomat);
        warehouses[0].ShouldBe(new WarehouseDto("it-w-1", 1, "Відділення №1", "вул. Енергетиків, 4", WarehouseType.Branch));
        (await client.GetFromJsonAsync<List<WarehouseDto>>($"/api/v1/delivery/np/warehouses?settlementRef={cityRef}&q=вокзальна", TestJson.Options, Ct))!
            .ShouldHaveSingleItem().Ref.ShouldBe("it-w-2");

        stub.Warehouses.RemoveAll(w => (string?)w["Ref"] == "it-w-2");
        var second = await SyncAsync(factory);
        second.Status.ShouldBe(SyncRunStatus.Succeeded, second.Summary);
        second.Summary!.ShouldContain("вимкнено 1");

        (await WarehousesAsync(client, cityRef)).Select(w => w.Ref).ShouldBe(["it-w-1", "it-p-31008"]);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            (await scope.ServiceProvider.GetRequiredService<IDeliveryDirectory>().FindWarehouseAsync("it-w-2", Ct)).ShouldBeNull();
            var row = await scope.ServiceProvider.GetRequiredService<PoliValkoDbContext>()
                .Set<NpWarehouse>().SingleAsync(w => w.Ref == "it-w-2", Ct);
            row.IsActive.ShouldBeFalse();
        }

        var admin = await LoginAsync(factory, ApiFactory.AdminEmail);
        var status = await admin.GetFromJsonAsync<NovaPoshtaStatusDto>("/api/v1/console/delivery/novaposhta", TestJson.Options, Ct);
        status!.Mode.ShouldBe("api");
        status.Settlements.ShouldBeGreaterThanOrEqualTo(1);
        status.Postomats.ShouldBeGreaterThanOrEqualTo(1);
        status.Sync.LastSuccessAt.ShouldNotBeNull();
        status.Sync.LastError.ShouldBeNull();
    }

    private async Task<UpdatePickupPointRequest> CurrentStoreAsRequestAsync()
    {
        var point = await api.WithDbAsync(db => db.Set<PickupLocation>().AsNoTracking().SingleAsync(p => p.Code == StoreCode, Ct));
        return new UpdatePickupPointRequest(point.Name, point.Address, point.Schedule, point.Instructions, point.MapUrl, point.IsActive);
    }

    private static async Task<SyncRun> SyncAsync(WebApplicationFactory<Program> factory)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var sync = scope.ServiceProvider.GetRequiredService<NovaPoshtaDirectorySync>();
        return await scope.ServiceProvider.GetRequiredService<ISyncJournal>()
            .RunAsync(NovaPoshtaSyncJob.JobName, "Інтеграційний тест", sync.RunAsync, Ct);
    }

    private static async Task<List<WarehouseDto>> WarehousesAsync(HttpClient client, string cityRef) =>
        (await client.GetFromJsonAsync<List<WarehouseDto>>($"/api/v1/delivery/np/warehouses?settlementRef={cityRef}", TestJson.Options, Ct))!;

    private static async Task<HttpClient> LoginAsync(WebApplicationFactory<Program> factory, string email)
    {
        var client = factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/console/auth/login", new LoginRequest(email, ApiFactory.TestPassword), Ct);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        return client;
    }

    private static async Task AddCsrfAsync(HttpClient client)
    {
        var csrf = await client.GetFromJsonAsync<CsrfTokenDto>("/api/v1/console/auth/csrf", Ct);
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf!.Token);
    }
}

internal sealed class NovaPoshtaStub : HttpMessageHandler
{
    public const string ApiKey = "integration-test-key";
    public const string AreaRef = "it-area-kyiv";

    public List<JsonObject> Cities { get; } = [];

    public List<JsonObject> Warehouses { get; } = [];

    public static JsonObject Warehouse(string reference, string cityRef, string description, string number, string category, string status = "Working") =>
        new()
        {
            ["Ref"] = reference,
            ["CityRef"] = cityRef,
            ["Description"] = description,
            ["Number"] = number,
            ["CategoryOfWarehouse"] = category,
            ["WarehouseStatus"] = status,
            ["DenyToSelect"] = "0",
        };

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!;
        body["apiKey"]!.GetValue<string>().ShouldBe(ApiKey);
        IReadOnlyList<JsonObject> data = body["calledMethod"]!.GetValue<string>() switch
        {
            "getAreas" => [new JsonObject { ["Ref"] = AreaRef, ["Description"] = "Київська" }],
            "getCities" => Cities,
            "getWarehouses" => Warehouses,
            var other => throw new InvalidOperationException($"Неочікуваний метод API: {other}"),
        };

        var response = new JsonObject
        {
            ["success"] = true,
            ["data"] = new JsonArray(data.Select(item => item.DeepClone()).ToArray()),
            ["errors"] = new JsonArray(),
            ["warnings"] = new JsonArray(),
            ["info"] = new JsonObject { ["totalCount"] = data.Count },
        };
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(response.ToJsonString(), Encoding.UTF8, "application/json"),
        };
    }
}
