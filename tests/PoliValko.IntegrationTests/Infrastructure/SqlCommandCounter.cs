using System.Collections.Concurrent;
using System.Data.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace PoliValko.IntegrationTests;

/// <summary>
/// Counts the SQL commands a request sends, for requests that carry <see cref="Header"/>. Each command is a round trip
/// to the database, which in production is a network hop away: the storefront pays for every one on a cache miss.
/// </summary>
public sealed class SqlCommandCounter(IHttpContextAccessor http) : DbCommandInterceptor
{
    public const string Header = "X-Test-Sql-Count";

    private static readonly ConcurrentDictionary<string, int> Counts = new();

    public static int Of(string key) => Counts.GetValueOrDefault(key);

    private void Count()
    {
        var key = http.HttpContext?.Request.Headers[Header].ToString();
        if (!string.IsNullOrEmpty(key)) Counts.AddOrUpdate(key, 1, (_, n) => n + 1);
    }

    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand command, CommandEventData eventData,
        InterceptionResult<DbDataReader> result)
    {
        Count();
        return result;
    }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
        CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        Count();
        return ValueTask.FromResult(result);
    }

    public override InterceptionResult<object> ScalarExecuting(DbCommand command, CommandEventData eventData,
        InterceptionResult<object> result)
    {
        Count();
        return result;
    }

    public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(DbCommand command,
        CommandEventData eventData, InterceptionResult<object> result, CancellationToken cancellationToken = default)
    {
        Count();
        return ValueTask.FromResult(result);
    }

    public override InterceptionResult<int> NonQueryExecuting(DbCommand command, CommandEventData eventData,
        InterceptionResult<int> result)
    {
        Count();
        return result;
    }

    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command,
        CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        Count();
        return ValueTask.FromResult(result);
    }
}
