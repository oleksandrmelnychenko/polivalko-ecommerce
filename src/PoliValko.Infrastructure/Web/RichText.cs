using Ganss.Xss;

namespace PoliValko.Infrastructure.Web;

/// <summary>
/// Очищення HTML, який працівники вводять в адмінці (описи товарів, текстові сторінки).
/// Лишає лише розмітку тексту: абзаци, списки, заголовки, таблиці й посилання.
/// </summary>
public interface IRichTextSanitizer
{
    /// <summary>null для порожнього результату.</summary>
    string? Sanitize(string? html);
}

internal sealed class RichTextSanitizer : IRichTextSanitizer
{
    private static readonly string[] Tags =
    [
        "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h2", "h3", "h4", "blockquote",
        "a", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "hr",
    ];

    private readonly HtmlSanitizer _sanitizer;

    public RichTextSanitizer()
    {
        _sanitizer = new HtmlSanitizer { KeepChildNodes = true };
        _sanitizer.AllowedTags.Clear();
        _sanitizer.AllowedTags.UnionWith(Tags);
        _sanitizer.AllowedAttributes.Clear();
        _sanitizer.AllowedAttributes.UnionWith(["href", "title", "colspan", "rowspan", "scope"]);
        _sanitizer.AllowedSchemes.Clear();
        _sanitizer.AllowedSchemes.UnionWith(["http", "https", "mailto", "tel"]);
        _sanitizer.AllowedCssProperties.Clear();
        _sanitizer.AllowedAtRules.Clear();
        _sanitizer.AllowedClasses.Clear();
        _sanitizer.AllowDataAttributes = false;

        // Зовнішні посилання з опису не передають вагу й доступ до вікна сайту.
        _sanitizer.PostProcessNode += (_, e) =>
        {
            if (e.Node is AngleSharp.Dom.IElement { TagName: "A" } link)
            {
                link.SetAttribute("rel", "nofollow noopener");
            }
        };
        _sanitizer.AllowedAttributes.Add("rel");
    }

    public string? Sanitize(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return null;
        }

        var clean = _sanitizer.Sanitize(html).Trim();
        return clean.Length == 0 ? null : clean;
    }
}
