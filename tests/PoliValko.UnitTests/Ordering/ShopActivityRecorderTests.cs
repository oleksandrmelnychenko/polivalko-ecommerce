using Microsoft.AspNetCore.Http;
using PoliValko.Ordering.Domain;
using PoliValko.Ordering.Features.Activity;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.UnitTests.Ordering;

public sealed class ShopActivityRecorderTests
{
    [Fact]
    public void DiffCartEvents_emits_adds_and_removes_with_exact_quantity_deltas()
    {
        var p1 = Guid.CreateVersion7();
        var p2 = Guid.CreateVersion7();
        var p3 = Guid.CreateVersion7();
        var http = new DefaultHttpContext();
        http.Request.Headers.UserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148";
        var now = new DateTimeOffset(2026, 11, 27, 14, 0, 0, TimeSpan.Zero);

        var before = new[] { new CartLineRequest(p1, 2), new CartLineRequest(p2, 3) };
        var after = new[] { new CartLineRequest(p1, 5), new CartLineRequest(p2, 1), new CartLineRequest(p3, 1) };

        var events = ShopActivityRecorder.DiffCartEvents("guest:a4f2c19999", before, after, http.Request, now);

        events.Count.ShouldBe(3);
        events.Single(e => e.ProductId == p1).ShouldSatisfyAllConditions(
            e => e.Kind.ShouldBe(ShopActivityKinds.CartAdd),
            e => e.Quantity.ShouldBe(3),
            e => e.VisitorTag.ShouldBe("A4F2C1"),
            e => e.Device.ShouldBe("mobile"),
            e => e.CustomerId.ShouldBeNull());

        events.Single(e => e.ProductId == p2).ShouldSatisfyAllConditions(
            e => e.Kind.ShouldBe(ShopActivityKinds.CartRemove),
            e => e.Quantity.ShouldBe(2));

        events.Single(e => e.ProductId == p3).ShouldSatisfyAllConditions(
            e => e.Kind.ShouldBe(ShopActivityKinds.CartAdd),
            e => e.Quantity.ShouldBe(1));
    }

    [Fact]
    public void Customer_owner_extracts_customer_id_and_empty_guest_tag()
    {
        var id = Guid.CreateVersion7();
        var owner = $"customer:{id}";
        ShopActivityRecorder.CustomerIdFromOwner(owner).ShouldBe(id);
        ShopActivityRecorder.GuestTag(owner).ShouldBe(string.Empty);
    }

    [Theory]
    [InlineData("compare_add", true)]
    [InlineData("compare_remove", true)]
    [InlineData("favorite_add", true)]
    [InlineData("favorite_remove", true)]
    [InlineData("cart_add", false)]
    [InlineData("unknown", false)]
    [InlineData(null, false)]
    public void Storefront_signal_whitelist_rejects_cart_and_invalid_kinds(string? kind, bool expected)
    {
        ShopActivityKinds.IsStorefrontSignal(kind).ShouldBe(expected);
    }
}
