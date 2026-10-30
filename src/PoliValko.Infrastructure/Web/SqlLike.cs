namespace PoliValko.Infrastructure.Web;

/// <summary>Шаблони для <c>EF.Functions.ILike</c> з пошукового рядка адмінки.</summary>
public static class SqlLike
{
    /// <summary>Символ екранування, який передається третім аргументом у <c>ILike</c>.</summary>
    public const string Escape = "\\";

    /// <summary>«Містить»: <c>%term%</c> з екранованими <c>%</c>, <c>_</c> і <c>\</c>.</summary>
    public static string Contains(string term) =>
        $"%{term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";

    /// <summary>Лише цифри з рядка: телефон шукається за цифрами незалежно від пробілів, дужок і «+».</summary>
    public static string Digits(string term) => new(term.Where(char.IsAsciiDigit).ToArray());
}
