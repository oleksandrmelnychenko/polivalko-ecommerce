using System.Text.Json;
using System.Text.Json.Serialization;

namespace PoliValko.IntegrationTests;

/// <summary>Ті самі налаштування JSON, що й в API: camelCase і enum як рядки.</summary>
public static class TestJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };
}
