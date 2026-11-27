using Ganss.Xss;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Storefront;

namespace PoliValko.Infrastructure.Text;

internal sealed class RichTextSanitizer : IRichTextSanitizer
{
    /// <summary>Links to other sites: the shop does not vouch for them and they cannot reach back through window.opener.</summary>
    internal const string ExternalLinkRel = "nofollow noopener";

    /// <summary>The shop's own domain; its subdomains (www, console) are the shop too.</summary>
    private const string ShopDomain = "poli-valko.com";

    private static readonly string[] Tags =
    [
        "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "h2", "h3", "h4", "blockquote",
        "a", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "hr",
    ];

    private readonly HtmlSanitizer _sanitizer;
    private readonly string? _siteHost;

    public RichTextSanitizer(IOptions<SiteOptions> site)
    {
        _siteHost = Uri.TryCreate(site.Value.PublicUrl, UriKind.Absolute, out var siteUri) ? siteUri.Host : null;

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

        // The editor's own rel (TipTap adds "noopener noreferrer nofollow" to every link) is never trusted:
        // links within the shop pass link equity to catalog and service pages, so they carry no rel at all;
        // only links to other sites are nofollow.
        _sanitizer.PostProcessNode += (_, e) =>
        {
            if (e.Node is AngleSharp.Dom.IElement { TagName: "A" } link)
            {
                if (IsExternal(link.GetAttribute("href")))
                {
                    link.SetAttribute("rel", ExternalLinkRel);
                }
                else
                {
                    link.RemoveAttribute("rel");
                }
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

    /// <summary>
    /// True for an http(s) link to another site. Relative links (/catalog/…, #faq, ?page=2), mailto:/tel: and
    /// absolute links to the shop's own host are not external.
    /// </summary>
    internal bool IsExternal(string? href)
    {
        var value = href?.Trim();
        if (string.IsNullOrEmpty(value))
        {
            return false;
        }

        // Protocol-relative "//host/path" leaves the site; a single "/" is a path on it. Checked before Uri parsing:
        // on Linux "/catalog" parses as an absolute file:// URI.
        if (value.StartsWith("//", StringComparison.Ordinal))
        {
            value = "https:" + value;
        }
        else if (value[0] is '/' or '#' or '?')
        {
            return false;
        }

        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme is not ("http" or "https"))
        {
            return false;
        }

        return !IsShopHost(uri.Host);
    }

    private bool IsShopHost(string host) =>
        host.Equals(ShopDomain, StringComparison.OrdinalIgnoreCase)
        || host.EndsWith("." + ShopDomain, StringComparison.OrdinalIgnoreCase)
        || (_siteHost is not null && host.Equals(_siteHost, StringComparison.OrdinalIgnoreCase));
}
