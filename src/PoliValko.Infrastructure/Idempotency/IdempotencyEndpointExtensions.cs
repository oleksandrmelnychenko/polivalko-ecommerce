using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.OpenApi;

namespace PoliValko.Infrastructure.Idempotency;

public static class IdempotencyEndpointExtensions
{
    /// <summary>Вимагає <c>Idempotency-Key</c> і описує заголовок в OpenAPI.</summary>
    public static RouteHandlerBuilder RequireIdempotency<TRequest>(this RouteHandlerBuilder builder)
        where TRequest : class
    {
        builder.AddEndpointFilter<IdempotencyFilter<TRequest>>();
        builder.AddOpenApiOperationTransformer((operation, _, _) =>
        {
            operation.Parameters ??= [];
            operation.Parameters.Add(new OpenApiParameter
            {
                Name = IdempotencyHeaders.Key,
                In = ParameterLocation.Header,
                Required = true,
                Description = "Унікальний ключ операції (UUID). Повторюйте той самий ключ під час повторних спроб.",
                Schema = new OpenApiSchema { Type = JsonSchemaType.String, Format = "uuid" },
            });
            return Task.CompletedTask;
        });
        return builder;
    }
}
