using System.Globalization;
using PoliValko.Content.Domain;
using PoliValko.Content.Persistence;
using PoliValko.Infrastructure.Media;

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

    [Fact]
    public void Seeded_banners_use_local_brand_assets_without_unsplash()
    {
        var banners = SiteSeeder.Banners(new DateTimeOffset(2026, 11, 26, 12, 0, 0, TimeSpan.Zero));

        banners.Length.ShouldBe(3);
        foreach (var banner in banners)
        {
            banner.ImageUrl.ShouldNotContain("unsplash.com");
            banner.ImageUrl.ShouldStartWith("/brand/");
            ImageUrls.IsValid(banner.ImageUrl).ShouldBeTrue();
        }
    }

    [Theory]
    [InlineData("https://www.facebook.com", true)]
    [InlineData("https://www.facebook.com/", true)]
    [InlineData("https://facebook.com", true)]
    [InlineData("https://www.instagram.com/", true)]
    [InlineData("https://www.facebook.com/polivalko", false)]
    [InlineData("https://www.instagram.com/poli_valko", false)]
    [InlineData(null, false)]
    public void Root_social_placeholder_detection_distinguishes_root_domains_from_profiles(string? url, bool expected)
    {
        SiteSeeder.IsRootSocialPlaceholder(url).ShouldBe(expected);
    }

    [Fact]
    public void Default_services_cover_every_direction_with_kyiv_oblast_seo_bounds()
    {
        SiteSeeder.DefaultServices.Keys.ShouldBe(ServiceDirections.All.Select(d => d.Code), ignoreOrder: true);
        foreach (var (_, seo) in SiteSeeder.DefaultServices)
        {
            seo.SeoTitle.Length.ShouldBeInRange(45, 60);
            seo.SeoDescription.Length.ShouldBeInRange(130, 155);
            seo.Description.ShouldContain("Бучі");
            seo.Description.ShouldContain("Київській області");
        }
    }
}
