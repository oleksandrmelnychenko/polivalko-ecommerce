using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Persistence;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Infrastructure.Idempotency;

internal sealed class IdempotencyFilter<TRequest> : IEndpointFilter
    where TRequest : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var key = http.Request.Headers[IdempotencyHeaders.Key].ToString();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 100)
        {
            return Problems.Create(
                StatusCodes.Status400BadRequest,
                "idempotency.key_required",
                "Потрібен заголовок Idempotency-Key",
                "Передайте унікальний ключ (UUID) для кожної нової операції та повторюйте його під час повторних спроб.");
        }

        var services = http.RequestServices;
        var db = services.GetRequiredService<PoliValkoDbContext>();
        var time = services.GetRequiredService<TimeProvider>();
        var json = services.GetRequiredService<IOptions<JsonOptions>>().Value.SerializerOptions;
        var ct = http.RequestAborted;

        var scope = $"{http.Request.Method} {(http.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? http.Request.Path.Value}";
        var identities = http.User.Identities.Where(i => i.IsAuthenticated).ToArray();
        if (identities.Any(i => string.IsNullOrWhiteSpace(i.FindFirst(ClaimTypes.NameIdentifier)?.Value)))
        {
            return Results.Unauthorized();
        }
        var subject = identities.Select(i => new { scheme = i.AuthenticationType, id = i.FindFirst(ClaimTypes.NameIdentifier)!.Value })
            .OrderBy(i => i.scheme, StringComparer.Ordinal).ThenBy(i => i.id, StringComparer.Ordinal);
        var subjectHash = Convert.ToHexStringLower(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(subject)));
        var hash = ComputeHash(context.Arguments.OfType<TRequest>().FirstOrDefault(), http.Request.RouteValues, json);

        var inserted = await db.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO integration.idempotency_keys (scope, key, request_hash, subject_hash, created_at)
            VALUES ({scope}, {key}, {hash}, {subjectHash}, {time.GetUtcNow()})
            ON CONFLICT DO NOTHING
            """,
            ct);

        if (inserted == 0)
        {
            return await ReplayAsync(db, http, scope, key, hash, subjectHash, ct);
        }

        object? result;
        try
        {
            result = await next(context);
        }
        catch
        {
            await ReleaseAsync(db, scope, key);
            throw;
        }

        var httpResult = result is INestedHttpResult nested ? nested.Result : result;
        if (httpResult is IStatusCodeHttpResult { StatusCode: >= 200 and < 300 } success)
        {
            var body = httpResult is IValueHttpResult { Value: { } value } ? JsonSerializer.Serialize(value, value.GetType(), json) : null;
            var location = httpResult.GetType().GetProperty("Location")?.GetValue(httpResult) as string;

            await db.IdempotencyRecords
                .Where(r => r.Scope == scope && r.Key == key)
                .ExecuteUpdateAsync(
                    s => s.SetProperty(r => r.StatusCode, success.StatusCode)
                        .SetProperty(r => r.ResponseBody, body)
                        .SetProperty(r => r.ResponseLocation, location)
                        .SetProperty(r => r.CompletedAt, time.GetUtcNow()),
                    CancellationToken.None);
        }
        else
        {
            await ReleaseAsync(db, scope, key);
        }

        return result;
    }

    private static async Task<IResult> ReplayAsync(
        PoliValkoDbContext db,
        HttpContext http,
        string scope,
        string key,
        string hash,
        string subjectHash,
        CancellationToken ct)
    {
        var record = await db.IdempotencyRecords.AsNoTracking()
            .SingleOrDefaultAsync(r => r.Scope == scope && r.Key == key, ct);

        // Legacy rows have no trustworthy owner. Never infer it from order email or customer linkage.
        if (record is not null && record.SubjectHash != subjectHash)
        {
            return Problems.Create(StatusCodes.Status409Conflict, "idempotency.owner_mismatch",
                "Неможливо повторити запит у поточній сесії",
                "Перевірте, чи операцію вже виконано. Поверніться до початкового акаунта або зверніться до підтримки; не створюйте повторне замовлення.");
        }

        if (record is not null && record.RequestHash != hash)
        {
            return Problems.Create(
                StatusCodes.Status422UnprocessableEntity,
                "idempotency.key_mismatch",
                "Ключ ідемпотентності вже використано для іншого запиту",
                "Для нової операції згенеруйте новий Idempotency-Key.");
        }

        if (record?.CompletedAt is null)
        {
            return Problems.Create(
                StatusCodes.Status409Conflict,
                "idempotency.in_progress",
                "Запит із цим ключем ще обробляється",
                "Повторіть запит трохи пізніше з тим самим Idempotency-Key.");
        }

        http.Response.Headers[IdempotencyHeaders.Replayed] = "true";
        if (record.ResponseLocation is not null)
        {
            http.Response.Headers.Location = record.ResponseLocation;
        }

        return record.ResponseBody is null
            ? Results.StatusCode(record.StatusCode ?? StatusCodes.Status200OK)
            : Results.Content(record.ResponseBody, "application/json", Encoding.UTF8, record.StatusCode);
    }

    private static Task ReleaseAsync(PoliValkoDbContext db, string scope, string key) =>
        db.IdempotencyRecords
            .Where(r => r.Scope == scope && r.Key == key && r.CompletedAt == null)
            .ExecuteDeleteAsync(CancellationToken.None);

    private static string ComputeHash(TRequest? request, RouteValueDictionary routeValues, JsonSerializerOptions json)
    {
        var payload = new
        {
            route = routeValues.OrderBy(r => r.Key, StringComparer.Ordinal).Select(r => $"{r.Key}={r.Value}"),
            body = request,
        };
        return Convert.ToHexStringLower(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(payload, json)));
    }
}
