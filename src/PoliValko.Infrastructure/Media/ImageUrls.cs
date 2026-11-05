namespace PoliValko.Infrastructure.Media;

public static class ImageUrls
{
    public const int MaxLength = 1000;

    public const string InvalidMessage = "Завантажте фото або вкажіть повне посилання, що починається з https://.";

    public static bool IsValid(string value)
    {
        if (value.Length > MaxLength || value.Any(char.IsWhiteSpace))
        {
            return false;
        }

        if (value.StartsWith('/'))
        {
            return !value.StartsWith("//", StringComparison.Ordinal) && !value.Contains('\\');
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http";
    }
}
