using System.Globalization;

namespace PoliValko.SharedKernel;

/// <summary>
/// Сума в контракті API. Значення передається десятковим рядком ("1299.00"),
/// щоб клієнти (JS, Swift, Kotlin) не втрачали точність на float.
/// </summary>
public sealed record MoneyDto(string Value, string Currency)
{
    public const string Uah = "UAH";

    public static MoneyDto Hryvnia(decimal amount) =>
        new(decimal.Round(amount, 2, MidpointRounding.AwayFromZero).ToString("0.00", CultureInfo.InvariantCulture), Uah);
}
