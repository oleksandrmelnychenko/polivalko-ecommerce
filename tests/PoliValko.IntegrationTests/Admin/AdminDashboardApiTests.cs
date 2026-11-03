using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using PoliValko.Admin.Features.Dashboard;
using PoliValko.Ordering.Contracts;
using PoliValko.SharedKernel;

namespace PoliValko.IntegrationTests;

public sealed class AdminDashboardApiTests(ApiFactory api)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DateOnly KyivToday => KyivTime.Today(TimeProvider.System);

    [Fact]
    public async Task Dashboard_shows_every_kyiv_day_and_counts_a_new_order()
    {
        var manager = await Staff.ManagerAsync(api);
        var before = await manager.ReadAsync<AdminDashboardDto>("/api/v1/admin/dashboard");
        var product = await api.AddProductAsync("ruchnyi-instrument", "Мотика для зведення", 731m, stock: 5);

        await TestOrders.PlaceAsync(api, product.Id, 2, 731m, CheckoutApiTests.UniquePhone());

        var after = await manager.ReadAsync<AdminDashboardDto>("/api/v1/admin/dashboard");
        after.Days.ShouldBe(30);
        after.ByDay.Count.ShouldBe(30);
        after.ByDay[^1].Date.ShouldBe(KyivToday);
        after.ByDay[0].Date.ShouldBe(KyivToday.AddDays(-29));
        after.Current.Orders.ShouldBe(before.Current.Orders + 1);
        Amount(after.Current.Revenue).ShouldBe(Amount(before.Current.Revenue) + 1462m);
        after.ByDay.Sum(d => d.Orders).ShouldBe(after.Current.Orders);
        after.ByStatus.Sum(s => s.Count).ShouldBe(after.Current.Orders);
        after.ByStatus.ShouldContain(s => s.Status == OrderStatus.New);
        after.ByStatus.Select(s => s.Status).ShouldBeInOrder();
        after.ByDelivery.ShouldContain(d => d.Method == DeliveryCodes.NovaPoshta);
        after.TopProducts.Count.ShouldBeLessThanOrEqualTo(5);
        after.LowStock.Count.ShouldBeLessThanOrEqualTo(8);
        after.LowStock.ShouldAllBe(p => p.Stock <= 3);

        var week = await manager.ReadAsync<AdminDashboardDto>("/api/v1/admin/dashboard?days=7");
        week.ByDay.Count.ShouldBe(7);
        week.ByDay[^1].Date.ShouldBe(KyivToday);

        var invalid = await manager.GetAsync("/api/v1/admin/dashboard?days=5", Ct);
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadFromJsonAsync<ProblemBody>(Ct))!.Errors!.ShouldContainKey("days");
    }

    private static decimal Amount(MoneyDto money) => decimal.Parse(money.Value, CultureInfo.InvariantCulture);
}
