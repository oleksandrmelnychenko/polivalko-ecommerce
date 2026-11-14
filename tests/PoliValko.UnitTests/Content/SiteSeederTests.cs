using System.Globalization;
using PoliValko.Content.Persistence;

namespace PoliValko.UnitTests;

public sealed class SiteSeederTests
{
    [Theory]
    [InlineData("2026-11-14T12:00:00Z", 2027)]
    [InlineData("2026-12-31T22:00:00Z", 2027)]
    [InlineData("2027-01-07T21:59:59Z", 2027)]
    [InlineData("2027-01-07T22:00:00Z", 2028)]
    public void New_year_season_uses_kyiv_calendar_and_returns_utc(string instant, int endYear)
    {
        var (startsAt, endsAt) = SiteSeeder.NewYearSeason(DateTimeOffset.Parse(instant, CultureInfo.InvariantCulture));

        startsAt.ShouldBe(new DateTimeOffset(endYear - 1, 10, 31, 22, 0, 0, TimeSpan.Zero));
        endsAt.ShouldBe(new DateTimeOffset(endYear, 1, 7, 22, 0, 0, TimeSpan.Zero));
        startsAt.Offset.ShouldBe(TimeSpan.Zero);
        endsAt.Offset.ShouldBe(TimeSpan.Zero);
    }
}
