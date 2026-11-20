using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Security.Permissions;
using PoliValko.Ordering.Features.Checkout;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class AdjustUpstreamPriceApiTests(ApiFactory api)
{
    private const string Products = "/api/v1/console/catalog/products";
    private const string Prices = Products + "/price";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Batch_only_updates_retail_preserves_reservation_and_sale_and_reprices_checkout_quote()
    {
        var first = await api.AddProductAsync("vse-dlia-polyvu", "Ціна для звірки", 30m, stock: 12m, oldPrice: 49m);
        var second = await api.AddProductAsync("vse-dlia-polyvu", "Ціна без акції", 40m, stock: 15m);
        var orderId = Guid.NewGuid();
        await api.WithDbAsync(async db =>
        {
            var product = await db.Set<Product>().Include(row => row.Stock).SingleAsync(row => row.Id == first.Id, Ct);
            product.DisplayName = "Назва для вітрини";
            product.DescriptionHtml = "<p>Опис товару</p>";
            product.Stock.ReservedQuantity = 3;
            db.Add(new ProductImage { Id = Guid.NewGuid(), ProductId = first.Id, Url = "https://example.test/photo.jpg", Alt = "Фото" });
            db.Add(new StockReservation { ProductId = first.Id, OrderId = orderId, Quantity = 3, CreatedAt = DateTimeOffset.UtcNow });
            return await db.SaveChangesAsync(Ct);
        });

        using var admin = await Staff.AdminAsync(api);
        var beforeFirst = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{first.Id}");
        var beforeSecond = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{second.Id}");
        var eventsBefore = await AvailabilityEventsAsync();
        var request = new AdjustUpstreamPriceRequest([Change(beforeFirst, 42.25m), Change(beforeSecond, 0m)]);

        var responses = await Task.WhenAll(
            admin.PostAsJsonAsync(Prices, request, TestJson.Options, Ct),
            admin.PostAsJsonAsync(Prices, request, TestJson.Options, Ct));
        (await responses.Single(response => response.StatusCode == HttpStatusCode.OK).ReadAsync<AdjustUpstreamPriceResult>()).Updated.ShouldBe(2);
        (await responses.Single(response => response.StatusCode == HttpStatusCode.Conflict)
            .ReadAsync<AdjustUpstreamPriceConflict>(HttpStatusCode.Conflict)).Conflicts
            .ShouldBe([new(first.Id, "price_changed"), new(second.Id, "price_changed")]);

        var afterFirst = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{first.Id}");
        var afterSecond = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{second.Id}");
        afterFirst.Navkolo.ShouldBe(beforeFirst.Navkolo with { Price = MoneyDto.Hryvnia(42.25m), PriceUpdatedAt = afterFirst.Navkolo.PriceUpdatedAt });
        afterSecond.Navkolo.ShouldBe(beforeSecond.Navkolo with { Price = MoneyDto.Hryvnia(0m), PriceUpdatedAt = afterSecond.Navkolo.PriceUpdatedAt });
        afterFirst.Navkolo.PriceUpdatedAt.ShouldBeGreaterThan(beforeFirst.Navkolo.PriceUpdatedAt);
        afterFirst.DisplayName.ShouldBe(beforeFirst.DisplayName);
        afterFirst.DescriptionHtml.ShouldBe(beforeFirst.DescriptionHtml);
        afterFirst.Images.ShouldBe(beforeFirst.Images);
        afterFirst.Labels.ShouldBe(beforeFirst.Labels);
        afterFirst.UpdatedAt.ShouldBe(beforeFirst.UpdatedAt);
        (await api.WithDbAsync(db => db.Set<ProductStock>().SingleAsync(row => row.ProductId == first.Id, Ct))).ReservedQuantity.ShouldBe(3m);
        var reservation = await api.WithDbAsync(db => db.Set<StockReservation>().SingleAsync(row => row.OrderId == orderId, Ct));
        (reservation.Quantity, reservation.Released, reservation.Consumed).ShouldBe((3, false, false));

        using var guest = api.CreateClient();
        var quote = await (await guest.PostAsJsonAsync("/api/v1/checkout/quote", new QuoteRequest([new(first.Id, 2)]), TestJson.Options, Ct))
            .ReadAsync<QuoteDto>();
        quote.Total.ShouldBe(MoneyDto.Hryvnia(84.50m));
        quote.Items[0].AvailableQuantity.ShouldBe(9);

        var unchanged = await (await admin.PostAsJsonAsync(Prices, new AdjustUpstreamPriceRequest([Change(afterFirst, 42.25m)]), TestJson.Options, Ct))
            .ReadAsync<AdjustUpstreamPriceResult>();
        unchanged.Updated.ShouldBe(0);
        (await admin.ReadAsync<ConsoleProductDto>($"{Products}/{first.Id}")).Navkolo.PriceUpdatedAt.ShouldBe(afterFirst.Navkolo.PriceUpdatedAt);
        (await AvailabilityEventsAsync()).ShouldBe(eventsBefore + 1);
        var entries = await api.WithDbAsync(db => db.Set<AuditEntry>().Where(entry => entry.Action == "catalog.upstream_price_adjusted")
            .Select(entry => entry.Details).ToListAsync(Ct));
        var audit = entries.Single(details => details?.Contains(first.Sku, StringComparison.Ordinal) == true);
        audit.ShouldNotBeNull().ShouldContain(second.Sku);
    }

    [Fact]
    public async Task Stale_identity_price_and_compare_at_guards_reject_an_entire_batch()
    {
        var clean = await api.AddProductAsync("vse-dlia-polyvu", "Ціна без конфлікту", 30m);
        var sale = await api.AddProductAsync("vse-dlia-polyvu", "Перекреслена ціна", 30m, oldPrice: 40m);
        var stale = await api.AddProductAsync("vse-dlia-polyvu", "Нова версія ціни", 30m);
        var wrongSku = await api.AddProductAsync("vse-dlia-polyvu", "Інший артикул", 30m);
        var compareAt = await api.AddProductAsync("vse-dlia-polyvu", "Інша перекреслена ціна", 30m, oldPrice: 40m);
        using var admin = await Staff.AdminAsync(api);
        var cleanDetail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{clean.Id}");
        var saleDetail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{sale.Id}");
        var staleDetail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{stale.Id}");
        var wrongSkuDetail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{wrongSku.Id}");
        var compareAtDetail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{compareAt.Id}");
        await api.WithDbAsync(db => db.Set<ProductPrice>().Where(row => row.ProductId == stale.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.UpdatedAt, staleDetail.Navkolo.PriceUpdatedAt.AddSeconds(1)), Ct));
        var eventsBefore = await AvailabilityEventsAsync();
        var missing = Guid.NewGuid();
        var request = new AdjustUpstreamPriceRequest([
            Change(cleanDetail, 35m), Change(saleDetail, 40m), Change(staleDetail, 35m),
            Change(wrongSkuDetail, 35m) with { ExpectedSku = "other-sku" },
            Change(compareAtDetail, 35m) with { ExpectedOldPrice = null },
            Change(cleanDetail, 35m) with { ProductId = missing, ExpectedSku = "missing-sku" },
        ]);

        var conflict = await (await admin.PostAsJsonAsync(Prices, request, TestJson.Options, Ct))
            .ReadAsync<AdjustUpstreamPriceConflict>(HttpStatusCode.Conflict);
        conflict.Conflicts.ShouldBe([
            new(sale.Id, "compare_at_conflict"), new(stale.Id, "price_changed"), new(wrongSku.Id, "price_changed"),
            new(compareAt.Id, "price_changed"), new(missing, "missing_product"),
        ]);
        (await admin.ReadAsync<ConsoleProductDto>($"{Products}/{clean.Id}")).Navkolo.ShouldBe(cleanDetail.Navkolo);
        (await admin.ReadAsync<ConsoleProductDto>($"{Products}/{sale.Id}")).Navkolo.ShouldBe(saleDetail.Navkolo);
        (await AvailabilityEventsAsync()).ShouldBe(eventsBefore);
    }

    [Fact]
    public async Task Price_adjustment_requires_permissions_csrf_and_explicit_expected_compare_at()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Ціна без змін", 30m);
        using var admin = await Staff.AdminAsync(api);
        using var viewOnly = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.ProductsView);
        using var noCsrf = await Staff.SignInAsync(api, ApiFactory.AdminEmail);
        using var guest = api.CreateClient();
        var detail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{product.Id}");
        var change = Change(detail, 33m);
        var request = new AdjustUpstreamPriceRequest([change]);

        (await guest.PostAsJsonAsync(Prices, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await viewOnly.PostAsJsonAsync(Prices, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await noCsrf.PostAsJsonAsync(Prices, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostAsJsonAsync(Prices, new AdjustUpstreamPriceRequest([change with { Price = 1.123m }]), TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostAsJsonAsync(Prices, new { changes = new[] { new { change.ProductId, change.ExpectedSku, change.ExpectedPrice, change.ExpectedPriceUpdatedAt, change.Price } } }, TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.ReadAsync<ConsoleProductDto>($"{Products}/{product.Id}")).Navkolo.ShouldBe(detail.Navkolo);
    }

    private static AdjustUpstreamPriceChange Change(ConsoleProductDto product, decimal price) => new(product.Id, product.Navkolo.Sku,
        decimal.Parse(product.Navkolo.Price.Value, CultureInfo.InvariantCulture),
        product.Navkolo.OldPrice is { } oldPrice ? decimal.Parse(oldPrice.Value, CultureInfo.InvariantCulture) : null,
        product.Navkolo.PriceUpdatedAt, price);

    private Task<int> AvailabilityEventsAsync() => api.WithDbAsync(db => db.OutboxMessages
        .CountAsync(message => message.Type == StockAvailabilityChanged.Type, Ct));
}
