using System.Text;

namespace PoliValko.SharedKernel;

public static class Transliteration
{
    private static readonly Dictionary<char, string> Map = new()
    {
        ['а'] = "a", ['б'] = "b", ['в'] = "v", ['г'] = "h", ['ґ'] = "g", ['д'] = "d", ['е'] = "e",
        ['є'] = "ie", ['ж'] = "zh", ['з'] = "z", ['и'] = "y", ['і'] = "i", ['ї'] = "i", ['й'] = "i",
        ['к'] = "k", ['л'] = "l", ['м'] = "m", ['н'] = "n", ['о'] = "o", ['п'] = "p", ['р'] = "r",
        ['с'] = "s", ['т'] = "t", ['у'] = "u", ['ф'] = "f", ['х'] = "kh", ['ц'] = "ts", ['ч'] = "ch",
        ['ш'] = "sh", ['щ'] = "shch", ['ю'] = "iu", ['я'] = "ia", ['ь'] = "", ['\''] = "", ['’'] = "", ['ʼ'] = "",
    };

    private static readonly Dictionary<char, string> WordStart = new()
    {
        ['є'] = "ye", ['ї'] = "yi", ['й'] = "y", ['ю'] = "yu", ['я'] = "ya",
    };

    public static string ToSlug(string text)
    {
        var lower = text.Trim().ToLowerInvariant();
        var sb = new StringBuilder(lower.Length * 2);
        var atWordStart = true;

        for (var i = 0; i < lower.Length; i++)
        {
            var c = lower[i];

            if (c == 'г' && i > 0 && lower[i - 1] == 'з')
            {
                sb.Append("gh");
                atWordStart = false;
                continue;
            }

            if (atWordStart && WordStart.TryGetValue(c, out var initial))
            {
                sb.Append(initial);
                atWordStart = false;
            }
            else if (Map.TryGetValue(c, out var latin))
            {
                sb.Append(latin);
                atWordStart = false;
            }
            else if (char.IsAsciiLetterOrDigit(c))
            {
                sb.Append(c);
                atWordStart = false;
            }
            else
            {
                if (sb.Length > 0 && sb[^1] != '-')
                {
                    sb.Append('-');
                }

                atWordStart = true;
            }
        }

        return sb.ToString().Trim('-');
    }
}
