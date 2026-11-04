using System.Net;
using System.Net.Http.Json;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Addresses;
using PoliValko.Ordering.Contracts;

namespace PoliValko.IntegrationTests;

public sealed class AccountAddressApiTests(ApiFactory api)
{
    private const string Url = "/api/v1/account/addresses";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Addresses_keep_exactly_one_default()
    {
        var (client, _) = await Accounts.RegisterAsync(api);
        (await client.ReadAsync<List<CustomerAddressDto>>(Url)).ShouldBeEmpty();

        var home = await (await client.PostJsonAsync(Url, Branch("Дім", isDefault: false))).ReadAsync<CustomerAddressDto>(HttpStatusCode.Created);
        home.IsDefault.ShouldBeTrue("перша адреса стає основною");
        home.Method.ShouldBe(DeliveryCodes.NovaPoshta);
        home.SettlementName.ShouldBe("Буча");
        home.WarehouseRef.ShouldBe("demo-bucha-b1");
        home.WarehouseName!.ShouldStartWith("Відділення №1");
        home.Address.ShouldBeNull();

        var courier = await (await client.PostJsonAsync(Url, Courier(isDefault: true))).ReadAsync<CustomerAddressDto>(HttpStatusCode.Created);
        courier.IsDefault.ShouldBeTrue();
        courier.Method.ShouldBe(DeliveryCodes.NovaPoshtaCourier);
        courier.WarehouseRef.ShouldBeNull();
        courier.Address.ShouldBe(new StreetAddressDto("вул. Хрещатик", "22", "5"));

        var list = await client.ReadAsync<List<CustomerAddressDto>>(Url);
        list.Select(a => (a.Id, a.IsDefault)).ShouldBe([(courier.Id, true), (home.Id, false)]);

        var renamed = await (await client.PutJsonAsync($"{Url}/{home.Id}", Branch("Робота", isDefault: true))).ReadAsync<CustomerAddressDto>();
        renamed.Label.ShouldBe("Робота");
        renamed.IsDefault.ShouldBeTrue();
        (await client.ReadAsync<List<CustomerAddressDto>>(Url)).Single(a => a.IsDefault).Id.ShouldBe(home.Id);

        var kept = await (await client.PutJsonAsync($"{Url}/{home.Id}", Branch("Робота", isDefault: false))).ReadAsync<CustomerAddressDto>();
        kept.IsDefault.ShouldBeTrue("основну адресу знімають, обравши іншу основною");

        (await client.DeleteAsync($"{Url}/{home.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await client.ReadAsync<List<CustomerAddressDto>>(Url)).ShouldHaveSingleItem().ShouldSatisfyAllConditions(
            a => a.Id.ShouldBe(courier.Id),
            a => a.IsDefault.ShouldBeTrue());

        var missing = await client.DeleteAsync($"{Url}/{home.Id}", Ct);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await missing.ProblemCodeAsync()).ShouldBe("account.address_not_found");

        var (stranger, _) = await Accounts.RegisterAsync(api);
        (await stranger.ReadAsync<List<CustomerAddressDto>>(Url)).ShouldBeEmpty();
        (await stranger.PutJsonAsync($"{Url}/{courier.Id}", Branch("Чужа", isDefault: true))).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await stranger.DeleteAsync($"{Url}/{courier.Id}", Ct)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await client.ReadAsync<List<CustomerAddressDto>>(Url)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task Address_is_validated_against_the_delivery_directory()
    {
        var (client, _) = await Accounts.RegisterAsync(api);

        await ShouldFailAsync(client, Branch("Дім", false) with { WarehouseRef = "demo-kyiv-b1" }, "warehouseRef");
        await ShouldFailAsync(client, Branch("Дім", false) with { SettlementRef = "unknown" }, "settlementRef");
        await ShouldFailAsync(client, Branch("Дім", false) with { Method = DeliveryCodes.Pickup }, "method");
        await ShouldFailAsync(client, Courier(false) with { Address = new StreetAddressRequest(" ", null, null) }, "address.house", "address.street");
        await ShouldFailAsync(client, Branch(new string('Д', 51), false), "label");
        (await client.ReadAsync<List<CustomerAddressDto>>(Url)).ShouldBeEmpty();
    }

    [Fact]
    public async Task Customer_can_keep_up_to_ten_addresses()
    {
        var (client, _) = await Accounts.RegisterAsync(api);
        for (var i = 0; i < CustomerAddress.MaxPerCustomer; i++)
        {
            (await client.PostJsonAsync(Url, Branch($"Адреса {i}", isDefault: false))).StatusCode.ShouldBe(HttpStatusCode.Created);
        }

        var overflow = await client.PostJsonAsync(Url, Branch("Зайва", isDefault: false));
        overflow.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await overflow.ProblemCodeAsync()).ShouldBe("account.address_limit");

        var list = await client.ReadAsync<List<CustomerAddressDto>>(Url);
        list.Count.ShouldBe(CustomerAddress.MaxPerCustomer);
        list.Count(a => a.IsDefault).ShouldBe(1);
        list[0].Label.ShouldBe("Адреса 0");
    }

    [Fact]
    public async Task Addresses_require_a_signed_in_customer()
    {
        var anonymous = await Accounts.AnonymousAsync(api);
        (await anonymous.GetAsync(Url, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await anonymous.PostAsJsonAsync(Url, Branch("Дім", false), Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static SaveCustomerAddressRequest Branch(string? label, bool isDefault) =>
        new(label, DeliveryCodes.NovaPoshta, "demo-bucha", "demo-bucha-b1", null, isDefault);

    private static SaveCustomerAddressRequest Courier(bool isDefault) =>
        new(null, DeliveryCodes.NovaPoshtaCourier, "demo-kyiv", null, new StreetAddressRequest("вул. Хрещатик", "22", "5"), isDefault);

    private static async Task ShouldFailAsync(HttpClient client, SaveCustomerAddressRequest request, params string[] fields)
    {
        var response = await client.PostJsonAsync(Url, request);
        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.Order().ShouldBe(fields.Order());
    }
}
