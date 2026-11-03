using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.OpenApi;

namespace PoliValko.Infrastructure.Web;

public static class QueryEnum
{
    public static bool TryParse<TEnum>(string? value, out TEnum? result)
        where TEnum : struct, Enum
    {
        result = null;
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (int.TryParse(value, out _) || !Enum.TryParse<TEnum>(value.Trim(), ignoreCase: true, out var parsed) || !Enum.IsDefined(parsed)) return false;
        result = parsed;
        return true;
    }

    public static string Allowed<TEnum>()
        where TEnum : struct, Enum =>
        string.Join(", ", Enum.GetNames<TEnum>().Select(JsonNamingPolicy.CamelCase.ConvertName));

    public static RouteHandlerBuilder WithEnumQuery<TEnum>(this RouteHandlerBuilder builder, string name)
        where TEnum : struct, Enum
    {
        builder.AddOpenApiOperationTransformer((operation, context, _) =>
        {
            var parameter = operation.Parameters?.FirstOrDefault(p => p.Name == name && p.In == ParameterLocation.Query);
            if (parameter is OpenApiParameter target)
            {
                target.Schema = new OpenApiSchemaReference(typeof(TEnum).Name, context.Document);
            }

            return Task.CompletedTask;
        });
        return builder;
    }
}
