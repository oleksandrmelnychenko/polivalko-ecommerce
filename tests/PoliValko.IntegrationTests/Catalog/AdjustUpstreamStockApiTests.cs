using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PoliValko.Catalog.Contracts;
using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Console.Products;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.IntegrationTests;

public sealed class AdjustUpstreamStockApiTests(ApiFactory api)
{
    private const string Products = "/api/v1/console/catalog/products";
    private const string Stock = Products + "/stock";
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Batch_adjusts_only_stock_and_accepts_at_most_one_concurrent_request()
    {
        var first = await api.AddProductAsync("vse-dlia-polyvu", "Залишок для звірки", 30m, stock: 12m, oldPrice: 49m);
        var second = await api.AddProductAsync("vse-dlia-polyvu", "Ще один залишок", 40m, stock: 15m);
        using var admin = await Staff.AdminAsync(api);
        var beforeFirst = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{first.Id}");
        var beforeSecond = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{second.Id}");
        var orderId = await ReserveAsync(first.Id, 3);
        var eventsBefore = await AvailabilityEventsAsync();
        var request = new AdjustUpstreamStockRequest([Change(beforeFirst, 7.125m), Change(beforeSecond, 8m)]);

        var responses = await Task.WhenAll(
            admin.PostAsJsonAsync(Stock, request, TestJson.Options, Ct),
            admin.PostAsJsonAsync(Stock, request, TestJson.Options, Ct));
        (await responses.Single(response => response.StatusCode == HttpStatusCode.OK).ReadAsync<AdjustUpstreamStockResult>()).Updated.ShouldBe(2);
        var replay = await responses.Single(response => response.StatusCode == HttpStatusCode.Conflict)
            .ReadAsync<AdjustUpstreamStockConflict>(HttpStatusCode.Conflict);
        replay.Conflicts.ShouldBe([new(first.Id, "stock_changed"), new(second.Id, "stock_changed")]);

        var afterFirst = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{first.Id}");
        var afterSecond = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{second.Id}");
        afterFirst.Navkolo.ShouldBe(beforeFirst.Navkolo with { Stock = 7.125m, StockUpdatedAt = afterFirst.Navkolo.StockUpdatedAt });
        afterSecond.Navkolo.ShouldBe(beforeSecond.Navkolo with { Stock = 8m, StockUpdatedAt = afterSecond.Navkolo.StockUpdatedAt });
        afterFirst.Navkolo.StockUpdatedAt.ShouldBeGreaterThan(beforeFirst.Navkolo.StockUpdatedAt);
        afterFirst.UpdatedAt.ShouldBe(beforeFirst.UpdatedAt);
        afterFirst.IsVisible.ShouldBe(beforeFirst.IsVisible);
        var stock = await api.WithDbAsync(db => db.Set<ProductStock>().SingleAsync(row => row.ProductId == first.Id, Ct));
        stock.ReservedQuantity.ShouldBe(3m);
        var reservation = await api.WithDbAsync(db => db.Set<StockReservation>().SingleAsync(row => row.OrderId == orderId, Ct));
        reservation.Quantity.ShouldBe(3);
        reservation.Released.ShouldBeFalse();
        reservation.Consumed.ShouldBeFalse();

        var auditDetails = (await StockAuditDetailsAsync()).Single(details => details?.Contains(first.Sku, StringComparison.Ordinal) == true);
        auditDetails.ShouldNotBeNull().ShouldContain(second.Sku);
        (await AvailabilityEventsAsync()).ShouldBe(eventsBefore + 1);
    }

    [Fact]
    public async Task Reservation_or_stale_source_conflict_rejects_the_whole_batch()
    {
        var clean = await api.AddProductAsync("vse-dlia-polyvu", "Залишок без конфлікту", 30m, stock: 10m);
        var reserved = await api.AddProductAsync("vse-dlia-polyvu", "Залишок із резервом", 30m, stock: 9m);
        var stale = await api.AddProductAsync("vse-dlia-polyvu", "Змінений залишок", 30m, stock: 8m);
        using var admin = await Staff.AdminAsync(api);
        var cleanDetail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{clean.Id}");
        var reservedDetail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{reserved.Id}");
        var staleDetail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{stale.Id}");
        await ReserveAsync(reserved.Id, 3);
        await api.WithDbAsync(db => db.Set<ProductStock>().Where(row => row.ProductId == stale.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(row => row.UpdatedAt, staleDetail.Navkolo.StockUpdatedAt.AddSeconds(1)), Ct));
        var eventsBefore = await AvailabilityEventsAsync();
        var missing = Guid.NewGuid();
        var request = new AdjustUpstreamStockRequest([
            Change(cleanDetail, 1m), Change(reservedDetail, 2m), Change(staleDetail, 3m), Change(cleanDetail, 4m) with { ProductId = missing },
        ]);

        var conflict = await (await admin.PostAsJsonAsync(Stock, request, TestJson.Options, Ct))
            .ReadAsync<AdjustUpstreamStockConflict>(HttpStatusCode.Conflict);
        conflict.Conflicts.ShouldBe([new(reserved.Id, "reserved_stock"), new(stale.Id, "stock_changed"), new(missing, "missing_product")]);
        (await admin.ReadAsync<ConsoleProductDto>($"{Products}/{clean.Id}")).Navkolo.ShouldBe(cleanDetail.Navkolo);
        (await admin.ReadAsync<ConsoleProductDto>($"{Products}/{reserved.Id}")).Navkolo.ShouldBe(reservedDetail.Navkolo);
        (await admin.ReadAsync<ConsoleProductDto>($"{Products}/{stale.Id}")).Navkolo.Stock.ShouldBe(8m);
        (await AvailabilityEventsAsync()).ShouldBe(eventsBefore);
        (await StockAuditDetailsAsync()).Any(details => details?.Contains(clean.Sku, StringComparison.Ordinal) == true).ShouldBeFalse();
    }

    [Fact]
    public async Task Stock_adjustment_requires_staff_permissions_csrf_and_a_complete_request()
    {
        var product = await api.AddProductAsync("vse-dlia-polyvu", "Недоторканий залишок", 30m, stock: 8m);
        using var admin = await Staff.AdminAsync(api);
        using var viewOnly = await TestRoles.LoginWithPermissionsAsync(api, admin, PermissionKeys.ProductsView);
        using var noCsrf = await Staff.SignInAsync(api, ApiFactory.AdminEmail);
        using var guest = api.CreateClient();
        var detail = await admin.ReadAsync<ConsoleProductDto>($"{Products}/{product.Id}");
        var change = Change(detail, 3m);
        var request = new AdjustUpstreamStockRequest([change]);

        (await guest.PostAsJsonAsync(Stock, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        (await viewOnly.PostAsJsonAsync(Stock, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await noCsrf.PostAsJsonAsync(Stock, request, TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostAsJsonAsync(Stock, new AdjustUpstreamStockRequest([change, change]), TestJson.Options, Ct)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostAsJsonAsync(Stock, new AdjustUpstreamStockRequest([change with { Quantity = 1.1234m }]), TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.PostAsJsonAsync(Stock, new { changes = new[] { new { change.ProductId, change.ExpectedNavkoloId, change.ExpectedQuantity, change.ExpectedStockUpdatedAt } } }, TestJson.Options, Ct))
            .StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.ReadAsync<ConsoleProductDto>($"{Products}/{product.Id}")).Navkolo.ShouldBe(detail.Navkolo);
    }

    private static AdjustUpstreamStockChange Change(ConsoleProductDto product, decimal quantity) =>
        new(product.Id, product.Navkolo.NavkoloId, product.Navkolo.Stock, product.Navkolo.StockUpdatedAt, quantity);

    private Task<int> AvailabilityEventsAsync() => api.WithDbAsync(db => db.OutboxMessages.CountAsync(message => message.Type == StockAvailabilityChanged.Type, Ct));

    private Task<List<string?>> StockAuditDetailsAsync() => api.WithDbAsync(db => db.Set<AuditEntry>()
        .Where(entry => entry.Action == "catalog.upstream_stock_adjusted").Select(entry => entry.Details).ToListAsync(Ct));

    private Task<Guid> ReserveAsync(Guid productId, int quantity) => api.WithScopeAsync(async services =>
    {
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var reservations = services.GetRequiredService<ICatalogReservations>();
        var orderId = Guid.NewGuid();
        await using var transaction = await db.Database.BeginTransactionAsync(Ct);
        await reservations.LockAsync([productId], Ct);
        await reservations.ReserveAsync(orderId, new Dictionary<Guid, int> { [productId] = quantity }, Ct);
        await db.SaveChangesAsync(Ct);
        await transaction.CommitAsync(Ct);
        return orderId;
    });
}
