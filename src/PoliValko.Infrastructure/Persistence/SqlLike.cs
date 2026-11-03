namespace PoliValko.Infrastructure.Persistence;

public static class SqlLike
{
    public const string Escape = "\\";

    public static string Contains(string term) =>
        $"%{term.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_")}%";

    public static string Digits(string term) => new(term.Where(char.IsAsciiDigit).ToArray());
}
