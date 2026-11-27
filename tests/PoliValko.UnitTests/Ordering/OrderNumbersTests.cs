using System.Text.RegularExpressions;
using PoliValko.Ordering.Features.Checkout;

namespace PoliValko.UnitTests.Ordering;

public sealed class OrderNumbersTests
{
    [Fact]
    public void Numbers_have_eight_digits_after_pv_and_never_repeat()
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        for (var sequence = 100_001L; sequence < 400_001L; sequence++)
        {
            var number = OrderNumbers.From(sequence);
            Regex.IsMatch(number, "^PV-[1-9][0-9]{7}$").ShouldBeTrue(number);
            seen.Add(number).ShouldBeTrue($"{number} came twice");
        }
    }

    [Fact]
    public void Consecutive_orders_do_not_show_how_many_came_between()
    {
        var numbers = Enumerable.Range(100_232, 20).Select(s => long.Parse(OrderNumbers.From(s)[3..])).ToArray();
        var steps = numbers.Zip(numbers.Skip(1), (a, b) => b - a).ToArray();
        steps.Distinct().Count().ShouldBeGreaterThan(15);
        steps.Count(step => step == 1).ShouldBe(0);
    }

    // Orders already carry these numbers: a change of key or rounds would hand them out again to new orders.
    [Theory]
    [InlineData(100_001L, "PV-39151467")]
    [InlineData(100_232L, "PV-90994802")]
    [InlineData(100_233L, "PV-92996715")]
    [InlineData(100_234L, "PV-64472011")]
    public void A_sequence_value_always_gives_the_same_number(long sequence, string number) =>
        OrderNumbers.From(sequence).ShouldBe(number);

    [Fact]
    public void New_numbers_never_equal_the_six_digit_numbers_given_before() =>
        Enumerable.Range(100_001, 50_000).Select(s => OrderNumbers.From(s).Length).Distinct().ShouldBe([11]);
}
