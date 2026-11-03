using System.Net;

namespace PoliValko.Catalog.Features.Import;

internal static class ImportText
{
    public static string? TextToHtml(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var paragraphs = text.Replace("\r\n", "\n", StringComparison.Ordinal)
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return string.Concat(paragraphs.Select(p => $"<p>{WebUtility.HtmlEncode(p)}</p>"));
    }
}
