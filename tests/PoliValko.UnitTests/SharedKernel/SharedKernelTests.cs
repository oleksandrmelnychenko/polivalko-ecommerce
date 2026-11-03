using PoliValko.SharedKernel;

namespace PoliValko.UnitTests;

public sealed class TransliterationTests
{
    [Theory]
    [InlineData("Все для відпочинку", "vse-dlia-vidpochynku")]
    [InlineData("Все для поливу", "vse-dlia-polyvu")]
    [InlineData("Все для рослин", "vse-dlia-roslyn")]
    [InlineData("Господарчі товари", "hospodarchi-tovary")]
    [InlineData("Ландшафтний дизайн", "landshaftnyi-dyzain")]
    [InlineData("Новий рік", "novyi-rik")]
    [InlineData("Ручний інструмент", "ruchnyi-instrument")]
    [InlineData("Техніка для саду та городу", "tekhnika-dlia-sadu-ta-horodu")]
    public void Top_level_categories_follow_kmu_55(string name, string slug) =>
        Transliteration.ToSlug(name).ShouldBe(slug);

    [Theory]
    [InlineData("Згорани", "zghorany")]
    [InlineData("Юрій", "yurii")]
    [InlineData("Яготин", "yahotyn")]
    [InlineData("Їжакевич", "yizhakevych")]
    [InlineData("Знам'янка", "znamianka")]
    [InlineData("Шланг поливальний 1/2\" 20 м", "shlanh-polyvalnyi-1-2-20-m")]
    public void Handles_word_start_letters_apostrophe_and_punctuation(string name, string slug) =>
        Transliteration.ToSlug(name).ShouldBe(slug);
}

public sealed class PhoneNumberTests
{
    [Theory]
    [InlineData("+380 67 123 45 67")]
    [InlineData("067-123-45-67")]
    [InlineData("380671234567")]
    [InlineData("(067) 123 45 67")]
    [InlineData("671234567")]
    public void Normalizes_ukrainian_numbers_to_e164(string input)
    {
        PhoneNumber.TryNormalizeUa(input, out var normalized).ShouldBeTrue();
        normalized.ShouldBe("+380671234567");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("12345")]
    [InlineData("+48 601 234 567")]
    [InlineData("0671234567a")]
    [InlineData("0001234567")]
    public void Rejects_invalid_numbers(string? input) =>
        PhoneNumber.TryNormalizeUa(input, out _).ShouldBeFalse();
}

public sealed class PagingTests
{
    [Fact]
    public void Page_request_is_clamped_to_allowed_range()
    {
        PageRequest.From(null, null).ShouldBe(new PageRequest(1, PageRequest.DefaultPageSize));
        PageRequest.From(0, 500).ShouldBe(new PageRequest(1, PageRequest.MaxPageSize));
        PageRequest.From(3, 10).Skip.ShouldBe(20);
    }

    [Fact]
    public void Total_pages_rounds_up() =>
        PagedResponse<int>.Create([], new PageRequest(1, 24), 49).TotalPages.ShouldBe(3);

    [Fact]
    public void Money_is_serialized_as_decimal_string_with_two_digits() =>
        MoneyDto.Hryvnia(1299.5m).ShouldBe(new MoneyDto("1299.50", "UAH"));
}

public sealed class KyivTimeTests
{
    [Theory]
    [InlineData("2026-01-15", "2026-01-14T22:00:00Z")]
    [InlineData("2026-07-01", "2026-06-30T21:00:00Z")]
    [InlineData("2026-10-25", "2026-10-24T21:00:00Z")]
    [InlineData("2026-10-26", "2026-10-25T22:00:00Z")]
    public void Day_starts_at_kyiv_midnight(string date, string utc) =>
        KyivTime.StartOfDay(DateOnly.Parse(date, System.Globalization.CultureInfo.InvariantCulture))
            .ShouldBe(DateTimeOffset.Parse(utc, System.Globalization.CultureInfo.InvariantCulture));

    [Fact]
    public void Late_utc_evening_is_already_next_day_in_kyiv() =>
        KyivTime.DateOf(new DateTimeOffset(2026, 10, 30, 22, 30, 0, TimeSpan.Zero)).ShouldBe(new DateOnly(2026, 10, 31));
}
