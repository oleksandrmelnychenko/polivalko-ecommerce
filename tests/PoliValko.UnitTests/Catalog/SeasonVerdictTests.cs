using PoliValko.Catalog.Domain;
using PoliValko.Catalog.Features.Storefront;

namespace PoliValko.UnitTests.Catalog;

public sealed class SeasonVerdictTests
{
    [Theory]
    // Enough purchases in the coming four weeks of past years, clearly above an even spread.
    [InlineData(4, 1, Season.In)]
    [InlineData(12, 6, Season.In)]
    [InlineData(30, 16, Season.In)]
    // Sold at other times of the year: the window is empty or nearly so, and the history is long enough to say it.
    [InlineData(0, 4, Season.Off)]
    [InlineData(2, 16, Season.Off)]
    // Sold evenly through the year.
    [InlineData(8, 8, Season.AllYear)]
    [InlineData(9, 16, Season.AllYear)]
    public void Receipts_in_the_window_decide_the_season(int observed, int expected, Season verdict) =>
        SeasonVerdict.Judge(observed, expected).ShouldBe(verdict);

    [Theory]
    [InlineData(0, 0)]
    [InlineData(3, 0.2)]   // fewer than four purchases never make a season
    [InlineData(0, 3.9)]   // too little history to call an empty window off season
    [InlineData(1, 4)]     // one purchase where four were expected is not yet evidence
    [InlineData(6, 4)]     // above an even spread, but within the noise of so few purchases
    [InlineData(4, 8)]     // exactly half is neither off season nor all-year
    [InlineData(12, 8)]    // exactly one and a half is neither in season nor all-year
    public void Thin_or_borderline_history_is_left_undecided(double observed, double expected) =>
        SeasonVerdict.Judge((decimal)observed, (decimal)expected).ShouldBeNull();

    [Theory]
    [InlineData(true, false, null, Season.In)]
    [InlineData(true, false, Season.Off, Season.In)]          // a rule for this month outranks sales history
    [InlineData(false, false, Season.In, Season.In)]
    [InlineData(false, true, Season.In, Season.In)]           // sales now outrank a rule written for other months
    [InlineData(false, false, Season.Off, Season.Off)]
    [InlineData(false, true, Season.Off, Season.Off)]
    [InlineData(false, true, null, Season.Off)]               // a rule for other months decides when history is silent
    [InlineData(false, true, Season.AllYear, Season.AllYear)] // ... but not against history that says all-year
    [InlineData(false, false, Season.AllYear, Season.AllYear)]
    [InlineData(false, false, null, Season.AllYear)]
    public void Rules_and_history_combine_into_one_state(bool ruleIn, bool ruleOff, Season? history, Season state) =>
        SeasonVerdict.Combine(ruleIn, ruleOff, history).ShouldBe(state);

    [Fact]
    public void A_product_with_thin_history_takes_the_verdict_of_the_nearest_category_that_has_one()
    {
        var root = Category(null);
        var section = Category(root.Id);
        var leaf = Category(section.Id);
        // The leaf alone is undecided; with its section it has no purchases where six were expected.
        var verdicts = SeasonVerdict.ByCategory([root, section, leaf], new Dictionary<Guid, (decimal, decimal)>
        {
            [leaf.Id] = (0, 1), [section.Id] = (0, 5),
        });
        verdicts[leaf.Id].ShouldBe((Season.Off, false));
        verdicts[section.Id].ShouldBe((Season.Off, false));
        verdicts[root.Id].ShouldBe((Season.Off, true));
    }

    [Fact]
    public void Only_the_department_may_have_enough_history()
    {
        var root = Category(null);
        var section = Category(root.Id);
        var leaf = Category(section.Id);
        var verdicts = SeasonVerdict.ByCategory([root, section, leaf], new Dictionary<Guid, (decimal, decimal)>
        {
            [leaf.Id] = (1, 2), [section.Id] = (1, 2), [root.Id] = (0, 6),
        });
        verdicts[leaf.Id].ShouldBe((Season.Off, true));
        verdicts[section.Id].ShouldBe((Season.Off, true));
    }

    [Fact]
    public void A_section_with_its_own_season_is_not_overruled_by_its_department()
    {
        var root = Category(null);
        var seasonal = Category(root.Id);
        var other = Category(root.Id);
        var verdicts = SeasonVerdict.ByCategory([root, seasonal, other], new Dictionary<Guid, (decimal, decimal)>
        {
            [seasonal.Id] = (10, 2), [other.Id] = (0, 30),
        });
        verdicts[seasonal.Id].ShouldBe((Season.In, false));
        verdicts[other.Id].ShouldBe((Season.Off, false));
        verdicts[root.Id].ShouldBe((Season.Off, true));
    }

    [Fact]
    public void Any_top_level_category_counts_as_a_department_and_silent_branches_stay_out()
    {
        var heaters = Category(null);
        var silent = Category(null);
        var orphan = Category(Guid.NewGuid()); // its parent is hidden, so it is the top of what the shop shows
        var verdicts = SeasonVerdict.ByCategory([heaters, silent, orphan], new Dictionary<Guid, (decimal, decimal)>
        {
            [heaters.Id] = (0, 9), [orphan.Id] = (20, 4),
        });
        verdicts[heaters.Id].ShouldBe((Season.Off, true));
        verdicts[orphan.Id].ShouldBe((Season.In, true));
        verdicts.ContainsKey(silent.Id).ShouldBeFalse();
    }

    private static Category Category(Guid? parent) =>
        new() { Id = Guid.NewGuid(), ParentId = parent, Slug = Guid.NewGuid().ToString(), Name = "Розділ" };
}
