using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Console.Features.Audit;
using PoliValko.Delivery.Domain;
using PoliValko.Delivery.Features.Console;
using PoliValko.Delivery.Features.Directory;
using PoliValko.Delivery.Features.Settings;
using PoliValko.Ordering.Contracts;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class DeliverySettingsApiTests(ApiFactory api)
{
    private const string Settings = "/api/v1/console/settings/delivery";
    private const string StoreCode = "bucha-store";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Checkout_offers_and_accepts_only_enabled_methods()
    {
        var admin = await Staff.AdminAsync(api);
        var original = await admin.ReadAsync<DeliverySettingsDto>(Settings);
        var product = await api.AddProductAsync("hospodarchi-tovary", "Лійка для налаштувань доставки", 210m, stock: 10);
        var checkout = new CheckoutApiTests(api);
        try
        {
            var saved = await (await admin.PutAsJsonAsync(Settings, new DeliverySettingsDto(
                    new NovaPoshtaSettingsDto(true, false),
                    new CourierSettingsDto(true, "  Буча, Ірпінь, Гостомель ", "Оплачує покупець за тарифом"),
                    new PickupSettingsDto(false)), TestJson.Options, Ct))
                .ReadAsync<DeliverySettingsDto>();
            saved.Courier.Area.ShouldBe("Буча, Ірпінь, Гостомель");
            (await admin.ReadAsync<DeliverySettingsDto>(Settings)).ShouldBe(saved);

            var quote = await QuoteAsync(product.Id);
            quote.DeliveryMethods.Select(d => d.Code).ShouldBe([DeliveryCodes.NovaPoshta, DeliveryCodes.NovaPoshtaCourier]);
            quote.DeliveryMethods[0].PaymentMethods.Select(p => p.Code).ShouldBe([PaymentCodes.Card]);
            (quote.DeliveryMethods[1].Description, quote.DeliveryMethods[1].PriceNote).ShouldBe(("Буча, Ірпінь, Гостомель", "Оплачує покупець за тарифом"));

            var pickup = await checkout.PostOrderAsync(PickupOrder(product.Id), Guid.NewGuid().ToString());
            pickup.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await pickup.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["delivery.method"]);

            var cashOnDelivery = await checkout.PostOrderAsync(CheckoutApiTests.Order(product.Id, 1, "210.00", CheckoutApiTests.UniquePhone()), Guid.NewGuid().ToString());
            cashOnDelivery.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            (await cashOnDelivery.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["payment.method"]);

            var card = await checkout.PostOrderAsync(
                CheckoutApiTests.Order(product.Id, 1, "210.00", CheckoutApiTests.UniquePhone()) with { Payment = new PaymentRequest(PaymentCodes.Card) },
                Guid.NewGuid().ToString());
            card.StatusCode.ShouldBe(HttpStatusCode.Created);

            var lastPoint = await admin.PutAsJsonAsync($"/api/v1/console/delivery/pickup-points/{StoreCode}", await StoreAsync() with { IsActive = false }, TestJson.Options, Ct);
            lastPoint.StatusCode.ShouldBe(HttpStatusCode.OK);

            var audit = await admin.ReadAsync<PagedResponse<AuditEntryDto>>("/api/v1/console/audit?entityType=DeliverySettings");
            audit.Items.ShouldContain(e => e.Action == "delivery.settings_updated");
        }
        finally
        {
            await admin.PutAsJsonAsync(Settings, original, TestJson.Options, Ct);
            await SetStoreActiveAsync(true);
        }

        (await QuoteAsync(product.Id)).DeliveryMethods.Select(d => d.Code)
            .ShouldBe([DeliveryCodes.NovaPoshta, DeliveryCodes.NovaPoshtaCourier, DeliveryCodes.Pickup]);
    }

    [Fact]
    public async Task Pickup_without_active_point_is_not_offered_and_does_not_break_order_creation()
    {
        var product = await api.AddProductAsync("hospodarchi-tovary", "Секатор без самовивозу", 150m, stock: 10);
        var checkout = new CheckoutApiTests(api);
        try
        {
            await SetStoreActiveAsync(false);

            (await QuoteAsync(product.Id)).DeliveryMethods.Select(d => d.Code).ShouldNotContain(DeliveryCodes.Pickup);
            var response = await checkout.PostOrderAsync(PickupOrder(product.Id, "150.00"), Guid.NewGuid().ToString());
            response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
            var problem = await response.Content.ReadFromJsonAsync<ProblemBody>(Ct);
            problem!.Code.ShouldBe("validation.failed");
            problem.Errors!.Keys.ShouldBe(["delivery.method"]);
        }
        finally
        {
            await SetStoreActiveAsync(true);
        }

        var created = await checkout.PostOrderAsync(PickupOrder(product.Id, "150.00"), Guid.NewGuid().ToString());
        var order = await created.ReadAsync<OrderCreatedDto>(HttpStatusCode.Created);
        var view = await api.CreateClient().GetFromJsonAsync<OrderDto>(
            $"/api/v1/orders/{order.Number}?token={Uri.EscapeDataString(order.AccessToken)}", TestJson.Options, Ct);
        view!.Delivery.PickupAddress.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Invalid_delivery_settings_are_rejected_and_manager_has_no_access()
    {
        var admin = await Staff.AdminAsync(api);
        var none = await admin.PutAsJsonAsync(Settings, new DeliverySettingsDto(
            new NovaPoshtaSettingsDto(false, true), new CourierSettingsDto(false, null, null), new PickupSettingsDto(false)), TestJson.Options, Ct);
        none.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await none.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Code.ShouldBe("delivery.no_methods");

        var tooLong = await admin.PutAsJsonAsync(Settings, new DeliverySettingsDto(
            new NovaPoshtaSettingsDto(true, true), new CourierSettingsDto(true, new string('з', 201), null), new PickupSettingsDto(true)), TestJson.Options, Ct);
        tooLong.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await tooLong.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.Keys.ShouldBe(["courier.area"]);

        var manager = await Staff.ManagerAsync(api);
        (await manager.GetAsync(Settings, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    private async Task<QuoteDto> QuoteAsync(Guid productId) =>
        await (await api.CreateClient().PostAsJsonAsync("/api/v1/checkout/quote", new QuoteRequest([new(productId, 1)]), TestJson.Options, Ct))
            .ReadAsync<QuoteDto>();

    private static CreateOrderRequest PickupOrder(Guid productId, string total = "210.00") =>
        CheckoutApiTests.Order(productId, 1, total, CheckoutApiTests.UniquePhone()) with
        {
            Delivery = new DeliveryRequest(DeliveryCodes.Pickup, null, null),
            Payment = new PaymentRequest(PaymentCodes.PayOnPickup),
        };

    private async Task<UpdatePickupPointRequest> StoreAsync()
    {
        var point = await api.WithDbAsync(db => db.Set<PickupLocation>().AsNoTracking().SingleAsync(p => p.Code == StoreCode, Ct));
        return new UpdatePickupPointRequest(point.Name, point.Address, point.Schedule, point.Instructions, point.MapUrl, point.IsActive);
    }

    private Task SetStoreActiveAsync(bool active) =>
        api.WithScopeAsync(async services =>
        {
            await services.GetRequiredService<PoliValko.Infrastructure.Persistence.PoliValkoDbContext>().Set<PickupLocation>()
                .Where(p => p.Code == StoreCode)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, active), Ct);
            services.GetRequiredService<PickupPointStore>().Invalidate();
            return true;
        });
}
