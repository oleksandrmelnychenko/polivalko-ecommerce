namespace PoliValko.Infrastructure.Persistence;

public static class SqlLike
{
    public const string Escape = "\\";

    public static string EscapePattern(string value) =>
        value.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);

    public static string Contains(string term) => $"%{EscapePattern(term)}%";

    public static string Digits(string term) => new(term.Where(char.IsAsciiDigit).ToArray());
}
