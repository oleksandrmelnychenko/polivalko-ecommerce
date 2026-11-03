using System.Globalization;
using System.Text.Json;

namespace PoliValko.Delivery.Integrations.NovaPoshta;

internal static class NovaPoshtaResponseParser
{
    public static NovaPoshtaPage<T> Parse<T>(JsonElement root, string name, Func<JsonElement, T?> map)
        where T : class
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new NovaPoshtaException($"Нова пошта повернула некоректну відповідь ({name}).");
        }

        var success = root.TryGetProperty("success", out var flag)
                      && (flag.ValueKind == JsonValueKind.True
                          || (flag.ValueKind == JsonValueKind.String && string.Equals(flag.GetString(), "true", StringComparison.OrdinalIgnoreCase)));
        if (!success)
        {
            var errors = Messages(root, "errors");
            var text = errors.Count > 0 ? string.Join("; ", errors) : "без опису помилки";
            throw new NovaPoshtaException(
                NovaPoshtaText.Truncate($"Нова пошта відхилила запит {name}: {text}", 1000),
                isTransient: errors.Any(IsRateLimitMessage));
        }

        var items = new List<T>();
        var raw = 0;
        if (root.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
        {
            foreach (var element in data.EnumerateArray())
            {
                raw++;
                if (element.ValueKind == JsonValueKind.Object && map(element) is { } item)
                {
                    items.Add(item);
                }
            }
        }

        return new NovaPoshtaPage<T>(items, raw, TotalCount(root));
    }

    public static string? Text(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value))
        {
            return null;
        }

        var text = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.GetRawText(),
            _ => null,
        };
        text = text?.Trim();
        return string.IsNullOrEmpty(text) ? null : text;
    }

    private static List<string> Messages(JsonElement root, string property)
    {
        var result = new List<string>();
        if (!root.TryGetProperty(property, out var value))
        {
            return result;
        }

        var values = value.ValueKind switch
        {
            JsonValueKind.Array => value.EnumerateArray().ToList(),
            JsonValueKind.Object => value.EnumerateObject().Select(p => p.Value).ToList(),
            JsonValueKind.String => [value],
            _ => [],
        };
        foreach (var item in values)
        {
            if (item.ValueKind == JsonValueKind.String && item.GetString() is { Length: > 0 } text)
            {
                result.Add(text.Trim());
            }
        }

        return result;
    }

    private static int? TotalCount(JsonElement root)
    {
        if (!root.TryGetProperty("info", out var info) || info.ValueKind != JsonValueKind.Object
            || !info.TryGetProperty("totalCount", out var total))
        {
            return null;
        }

        return total.ValueKind switch
        {
            JsonValueKind.Number when total.TryGetInt32(out var number) => number,
            JsonValueKind.String when int.TryParse(total.GetString(), NumberStyles.None, CultureInfo.InvariantCulture, out var number) => number,
            _ => null,
        };
    }

    private static bool IsRateLimitMessage(string message) =>
        message.Contains("many requests", StringComparison.OrdinalIgnoreCase)
        || message.Contains("rate limit", StringComparison.OrdinalIgnoreCase)
        || message.Contains("ліміт", StringComparison.OrdinalIgnoreCase);
}
