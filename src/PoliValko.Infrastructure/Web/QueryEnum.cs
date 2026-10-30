using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.OpenApi;

namespace PoliValko.Infrastructure.Web;

/// <summary>
/// Перелічення в параметрах адреси. Minimal API зв'язує enum із query через <c>Enum.TryParse</c> з урахуванням
/// регістру, а JSON і OpenAPI описують значення в camelCase («new», «awaitingPayment»), тож типізований клієнт
/// отримував 400. Тут параметр приймається рядком і розбирається без урахування регістру; в OpenAPI лишається
/// посилання на схему перелічення.
/// </summary>
public static class QueryEnum
{
    /// <summary>null — параметра немає; false — значення не входить у перелічення.</summary>
    public static bool TryParse<TEnum>(string? value, out TEnum? result)
        where TEnum : struct, Enum
    {
        result = null;
        if (string.IsNullOrWhiteSpace(value)) return true;
        if (int.TryParse(value, out _) || !Enum.TryParse<TEnum>(value.Trim(), ignoreCase: true, out var parsed) || !Enum.IsDefined(parsed)) return false;
        result = parsed;
        return true;
    }

    /// <summary>Допустимі значення так, як їх пише API в JSON.</summary>
    public static string Allowed<TEnum>()
        where TEnum : struct, Enum =>
        string.Join(", ", Enum.GetNames<TEnum>().Select(JsonNamingPolicy.CamelCase.ConvertName));

    /// <summary>Описує рядковий параметр query в OpenAPI як посилання на схему перелічення <typeparamref name="TEnum"/>.</summary>
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
