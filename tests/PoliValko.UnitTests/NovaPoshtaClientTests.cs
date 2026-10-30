using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using PoliValko.Delivery;
using PoliValko.Delivery.NovaPoshta;

namespace PoliValko.UnitTests;

public sealed class NovaPoshtaClientTests
{
    private const string ApiKey = "unit-test-key";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Cities_are_paged_by_total_count_and_get_area_names()
    {
        var handler = new FakeNovaPoshta((request, _) => request.Page switch
        {
            "1" => Success(
                [
                    new JsonObject { ["Ref"] = "city-kyiv", ["Description"] = "Київ", ["AreaDescription"] = "Київська" },
                    new JsonObject { ["Ref"] = "city-lviv", ["Description"] = "Львів", ["Area"] = "area-lviv" },
                ],
                totalCount: 4),
            _ => Success(
                [
                    new JsonObject { ["Ref"] = "city-bucha", ["Description"] = " Буча ", ["AreaDescription"] = "Київська обл." },
                    new JsonObject { ["Description"] = "Без Ref" },
                ],
                totalCount: 4),
        });
        var client = CreateClient(handler, pageSize: 2);

        var settlements = new List<Settlement>();
        await foreach (var page in client.GetCityPagesAsync(new Dictionary<string, string> { ["area-lviv"] = "Львівська" }, Ct))
        {
            settlements.AddRange(page);
        }

        settlements.ShouldBe(
        [
            new Settlement("city-kyiv", "Київ", "Київська обл."),
            new Settlement("city-lviv", "Львів", "Львівська обл."),
            new Settlement("city-bucha", "Буча", "Київська обл."),
        ]);
        handler.Requests.Count.ShouldBe(2);
        handler.Requests.ShouldAllBe(r => r.ApiKey == ApiKey && r.ModelName == "Address" && r.CalledMethod == "getCities" && r.Limit == "2");
        handler.Requests.Select(r => r.Page).ShouldBe(["1", "2"]);
    }

    [Fact]
    public async Task Without_total_count_paging_stops_on_short_page()
    {
        var handler = new FakeNovaPoshta((request, _) => request.Page switch
        {
            "1" => Success([City("a"), City("b")], infoAsEmptyArray: true),
            _ => Success([City("c")], infoAsEmptyArray: true),
        });
        var client = CreateClient(handler, pageSize: 2);

        var refs = new List<string>();
        await foreach (var page in client.GetCityPagesAsync(new Dictionary<string, string>(), Ct))
        {
            refs.AddRange(page.Select(s => s.Ref));
        }

        refs.ShouldBe(["a", "b", "c"]);
        handler.Requests.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Warehouses_map_to_branches_and_postomats_and_skip_non_working()
    {
        var handler = new FakeNovaPoshta((_, _) => Success(
        [
            Warehouse("w-branch", "Відділення №1: вул. Пирогівський шлях, 135", "1", category: "Branch"),
            Warehouse("w-postomat", "Поштомат \"Нова Пошта\" №30215: вул. Хрещатик, 22", "30215", category: "Postomat"),
            Warehouse("w-privat", "Поштомат ПриватБанку №31008", "31008", typeRef: "f9316480-5f2d-425d-bc2c-ac7cd29decf0", shortAddress: "Буча, вул. Нове Шосе, 8"),
            Warehouse("w-closed", "Відділення №2: вул. Вокзальна, 61", "2", status: "Closed"),
            Warehouse("w-deny", "Відділення №3: вул. Енергетиків, 4", "3", denyToSelect: "1"),
            new JsonObject { ["Ref"] = "w-no-city", ["Description"] = "Відділення №4: вул. Нова, 1", ["Number"] = "4" },
        ]));
        var client = CreateClient(handler, pageSize: 500);

        var warehouses = new List<Warehouse>();
        await foreach (var page in client.GetWarehousePagesAsync(Ct))
        {
            warehouses.AddRange(page);
        }

        warehouses.ShouldBe(
        [
            new Warehouse("w-branch", "city-1", 1, "Відділення №1", "вул. Пирогівський шлях, 135", WarehouseType.Branch),
            new Warehouse("w-postomat", "city-1", 30215, "Поштомат \"Нова Пошта\" №30215", "вул. Хрещатик, 22", WarehouseType.Postomat),
            new Warehouse("w-privat", "city-1", 31008, "Поштомат ПриватБанку №31008", "Буча, вул. Нове Шосе, 8", WarehouseType.Postomat),
        ]);
        var request = handler.Requests.ShouldHaveSingleItem();
        request.ModelName.ShouldBe("AddressGeneral");
        request.CalledMethod.ShouldBe("getWarehouses");
        request.Page.ShouldBe("1");
    }

    [Fact]
    public async Task Api_error_becomes_exception_without_api_key_and_is_not_retried()
    {
        var handler = new FakeNovaPoshta((_, _) => Json(new JsonObject
        {
            ["success"] = false,
            ["data"] = new JsonArray(),
            ["errors"] = new JsonArray("API key expired"),
        }));
        var client = CreateClient(handler);

        var ex = await Should.ThrowAsync<NovaPoshtaException>(() => client.GetAreasAsync(Ct));

        ex.Message.ShouldContain("Address.getAreas");
        ex.Message.ShouldContain("API key expired");
        ex.Message.ShouldNotContain(ApiKey);
        ex.IsTransient.ShouldBeFalse();
        handler.Requests.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Rate_limits_and_server_errors_are_retried()
    {
        var handler = new FakeNovaPoshta((_, call) => call switch
        {
            0 => RetryLater(HttpStatusCode.TooManyRequests),
            1 => Json(new JsonObject { ["success"] = false, ["errors"] = new JsonObject { ["20000200068"] = "To many requests" } }),
            2 => new HttpResponseMessage(HttpStatusCode.BadGateway),
            _ => Success([new JsonObject { ["Ref"] = "area-1", ["Description"] = "Київська" }]),
        });
        var client = CreateClient(handler);

        var areas = await client.GetAreasAsync(Ct);

        areas["area-1"].ShouldBe("Київська");
        handler.Requests.Count.ShouldBe(4);
    }

    [Fact]
    public async Task Gives_up_after_max_retries()
    {
        var handler = new FakeNovaPoshta((_, _) => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        var client = CreateClient(handler, maxRetries: 2);

        var ex = await Should.ThrowAsync<NovaPoshtaException>(() => client.GetAreasAsync(Ct));

        ex.IsTransient.ShouldBeTrue();
        ex.Message.ShouldContain("503");
        handler.Requests.Count.ShouldBe(3);
    }

    [Fact]
    public async Task Cancellation_stops_paging()
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(Ct);
        var handler = new FakeNovaPoshta((_, _) =>
        {
            cts.Cancel();
            return Success([City("a"), City("b")]);
        });
        var client = CreateClient(handler, pageSize: 2);

        var ex = await Record.ExceptionAsync(async () =>
        {
            await foreach (var _ in client.GetCityPagesAsync(new Dictionary<string, string>(), cts.Token))
            {
            }
        });

        ex.ShouldBeAssignableTo<OperationCanceledException>();
        handler.Requests.Count.ShouldBe(1);
    }

    [Fact]
    public void Description_without_colon_uses_short_address()
    {
        NovaPoshtaClient.SplitDescription("Пункт приймання-видачі", "Ірпінь, вул. Соборна, 105")
            .ShouldBe(("Пункт приймання-видачі", "Ірпінь, вул. Соборна, 105"));
        NovaPoshtaClient.FormatArea("Київська").ShouldBe("Київська обл.");
        NovaPoshtaClient.FormatArea("АРК").ShouldBe("АРК");
        NovaPoshtaClient.FormatArea(null).ShouldBe(string.Empty);
    }

    private static NovaPoshtaClient CreateClient(FakeNovaPoshta handler, int pageSize = 500, int maxRetries = 3)
    {
        var options = new NovaPoshtaOptions
        {
            ApiKey = ApiKey,
            PageSize = pageSize,
            PageDelay = TimeSpan.Zero,
            RetryDelay = TimeSpan.Zero,
            MaxRetries = maxRetries,
        };
        var http = new HttpClient(handler) { BaseAddress = new Uri(options.BaseUrl) };
        return new NovaPoshtaClient(http, Options.Create(options), TimeProvider.System, NullLogger<NovaPoshtaClient>.Instance);
    }

    private static JsonObject City(string reference) =>
        new() { ["Ref"] = reference, ["Description"] = $"Місто {reference}", ["AreaDescription"] = "Київська" };

    private static JsonObject Warehouse(
        string reference,
        string description,
        string number,
        string? category = null,
        string? typeRef = null,
        string status = "Working",
        string denyToSelect = "0",
        string? shortAddress = null) =>
        new()
        {
            ["Ref"] = reference,
            ["CityRef"] = "city-1",
            ["SettlementRef"] = "settlement-1",
            ["Description"] = description,
            ["ShortAddress"] = shortAddress,
            ["Number"] = number,
            ["CategoryOfWarehouse"] = category,
            ["TypeOfWarehouse"] = typeRef ?? "841339c7-591a-42e2-8233-7a0a00f0ed6f",
            ["WarehouseStatus"] = status,
            ["DenyToSelect"] = denyToSelect,
        };

    private static HttpResponseMessage Success(JsonObject[] data, int? totalCount = null, bool infoAsEmptyArray = false)
    {
        JsonNode info = infoAsEmptyArray || totalCount is null ? new JsonArray() : new JsonObject { ["totalCount"] = totalCount };
        return Json(new JsonObject
        {
            ["success"] = true,
            ["data"] = new JsonArray(data.Select(JsonNode? (d) => d).ToArray()),
            ["errors"] = new JsonArray(),
            ["warnings"] = new JsonArray(),
            ["info"] = info,
        });
    }

    private static HttpResponseMessage RetryLater(HttpStatusCode status)
    {
        var response = new HttpResponseMessage(status);
        response.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.Zero);
        return response;
    }

    private static HttpResponseMessage Json(JsonObject body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json") };
}

/// <summary>Підміна API Нової пошти: записує тіла запитів і відповідає заданим сценарієм без мережі.</summary>
internal sealed class FakeNovaPoshta(Func<NovaPoshtaRequestBody, int, HttpResponseMessage> respond) : HttpMessageHandler
{
    public List<NovaPoshtaRequestBody> Requests { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        request.Method.ShouldBe(HttpMethod.Post);
        request.RequestUri.ShouldBe(new Uri("https://api.novaposhta.ua/v2.0/json/"));
        request.Content!.Headers.ContentType!.MediaType.ShouldBe("application/json");

        using var document = JsonDocument.Parse(await request.Content.ReadAsStringAsync(cancellationToken));
        var root = document.RootElement;
        var properties = root.GetProperty("methodProperties");
        var body = new NovaPoshtaRequestBody(
            root.GetProperty("apiKey").GetString(),
            root.GetProperty("modelName").GetString(),
            root.GetProperty("calledMethod").GetString(),
            properties.TryGetProperty("Page", out var page) ? page.GetString() : null,
            properties.TryGetProperty("Limit", out var limit) ? limit.GetString() : null);
        var call = Requests.Count;
        Requests.Add(body);
        return respond(body, call);
    }
}

internal sealed record NovaPoshtaRequestBody(string? ApiKey, string? ModelName, string? CalledMethod, string? Page, string? Limit);
