using System.Net;
using System.Net.Http.Json;
using PoliValko.Console.Features.Audit;
using PoliValko.Content.Features.SiteContent;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.Ordering.Features.Shop;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class ShopSettingsApiTests(ApiFactory api)
{
    private const string Shop = "/api/v1/console/settings/shop";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Seller_and_special_days_reach_offer_contacts_and_new_orders()
    {
        var admin = await Staff.AdminAsync(api);
        var original = await admin.ReadAsync<ShopSettingsDto>(Shop);
        original.Seller.Name.ShouldNotBeNullOrWhiteSpace();
        var today = KyivTime.Today(TimeProvider.System);
        try
        {
            api.Storefront.Tags.Clear();
            var request = new ShopSettingsDto(
                new ShopSellerDto("  ФОП Тестовий Продавець  ", "1234 567 890", "м. Буча, вул. Тестова, 1", "ua21 3223 1300 0002 6007 2335 6600 1", "Shop@Example.com", "+380 67 000 00 00"),
                [
                    new ShopSpecialDayDto(today.AddDays(10), "День Незалежності", false, "10:00–16:00"),
                    new ShopSpecialDayDto(today.AddDays(-3), "Минуле свято", true, null),
                    new ShopSpecialDayDto(today.AddDays(2), "Санітарний день", true, "ігнорується"),
                ]);
            var saved = await (await admin.PutAsJsonAsync(Shop, request, TestJson.Options, Ct)).ReadAsync<ShopSettingsDto>();
            saved.Seller.ShouldBe(new ShopSellerDto("ФОП Тестовий Продавець", "1234567890", "м. Буча, вул. Тестова, 1", "UA213223130000026007233566001", "Shop@Example.com", "+380 67 000 00 00"));
            saved.SpecialDays.Select(d => d.Date).ShouldBe([today.AddDays(-3), today.AddDays(2), today.AddDays(10)]);
            saved.SpecialDays.Single(d => d.Date == today.AddDays(2)).Hours.ShouldBeNull();
            api.Storefront.Tags.ShouldContain("content");

            var reloaded = await admin.ReadAsync<ShopSettingsDto>(Shop);
            reloaded.Seller.ShouldBe(saved.Seller);
            reloaded.SpecialDays.ShouldBe(saved.SpecialDays);

            var client = api.CreateClient();
            var seller = await client.GetFromJsonAsync<SellerDto>("/api/v1/seller", TestJson.Options, Ct);
            seller.ShouldBe(new SellerDto("ФОП Тестовий Продавець", "1234567890", "м. Буча, вул. Тестова, 1", "UA213223130000026007233566001", "Shop@Example.com", "+380 67 000 00 00"));

            var contacts = await client.GetFromJsonAsync<ContactsDto>("/api/v1/contacts", TestJson.Options, Ct);
            contacts!.SpecialDays!.Select(d => d.Date).ShouldBe([today.AddDays(2), today.AddDays(10)]);
            contacts.SpecialDays![1].ShouldBe(new SpecialDayDto(today.AddDays(10), "День Незалежності", false, "10:00–16:00"));

            var product = await api.AddProductAsync("hospodarchi-tovary", "Відро для реквізитів", 120m);
            var created = await TestOrders.PlaceAsync(api, product.Id, 1, 120m, CheckoutApiTests.UniquePhone());
            var order = await client.GetFromJsonAsync<OrderDto>(
                $"/api/v1/orders/{created.Number}?token={Uri.EscapeDataString(created.AccessToken)}", TestJson.Options, Ct);
            order!.SellerName.ShouldBe("ФОП Тестовий Продавець");

            var audit = await admin.ReadAsync<PagedResponse<AuditEntryDto>>("/api/v1/console/audit?entityType=ShopSettings");
            audit.Items.ShouldContain(e => e.Action == "settings.shop_updated");
        }
        finally
        {
            await admin.PutAsJsonAsync(Shop, original, TestJson.Options, Ct);
        }
    }

    [Fact]
    public async Task Invalid_shop_settings_are_rejected_and_manager_has_no_access()
    {
        var admin = await Staff.AdminAsync(api);
        var day = KyivTime.Today(TimeProvider.System).AddDays(5);
        var invalid = await admin.PutAsJsonAsync(Shop, new ShopSettingsDto(
            new ShopSellerDto("", "12345", null, "UA12", "not-an-email", null),
            [
                new ShopSpecialDayDto(day, "Свято", true, null),
                new ShopSpecialDayDto(day, "", false, null),
            ]), TestJson.Options, Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(
            ["seller.name", "seller.taxId", "seller.iban", "seller.email", "specialDays[1].date", "specialDays[1].label", "specialDays[1].hours"],
            ignoreOrder: true);

        var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync(Shop, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await manager.PutAsJsonAsync(Shop, new ShopSettingsDto(new ShopSellerDto("Х", null, null, null, null, null), []), TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Contacts_keep_viber_link()
    {
        var admin = await Staff.AdminAsync(api);
        var original = await admin.ReadAsync<ContactsDto>("/api/v1/console/content/contacts");
        try
        {
            var saved = await (await admin.PutAsJsonAsync("/api/v1/console/content/contacts", original with { Viber = "viber://chat?number=%2B380670000000" }, TestJson.Options, Ct))
                .ReadAsync<ContactsDto>();
            saved.Viber.ShouldBe("viber://chat?number=%2B380670000000");
            (await api.CreateClient().GetFromJsonAsync<ContactsDto>("/api/v1/contacts", TestJson.Options, Ct))!.Viber
                .ShouldBe("viber://chat?number=%2B380670000000");

            var invalid = await admin.PutAsJsonAsync("/api/v1/console/content/contacts", original with { Viber = "tel:+380670000000" }, TestJson.Options, Ct);
            invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["viber"]);
        }
        finally
        {
            await admin.PutAsJsonAsync("/api/v1/console/content/contacts", original, TestJson.Options, Ct);
        }
    }
}
