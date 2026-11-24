using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.UnitTests.Ordering;

public sealed class CartLineValidationTests
{
    [Fact]
    public void A_line_without_a_product_is_named_as_such_not_as_a_wrong_quantity()
    {
        var errors = new Dictionary<string, string[]>();

        CheckoutCalculator.ValidateItems([new CartLineRequest(Guid.Empty, 1)], errors);

        errors["items"].ShouldBe(["У кошику є рядок без товару."]);
    }

    [Fact]
    public void A_wrong_quantity_keeps_its_own_message()
    {
        var errors = new Dictionary<string, string[]>();

        CheckoutCalculator.ValidateItems([new CartLineRequest(Guid.NewGuid(), 0)], errors);

        errors["items"].ShouldBe([$"Кількість має бути від 1 до {CheckoutCalculator.MaxQuantity}."]);
    }
}
