using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace PoliValko.Infrastructure.Web;

public static class Problems
{
    public static ProblemHttpResult Create(
        int status,
        string code,
        string title,
        string? detail = null,
        IEnumerable<KeyValuePair<string, object?>>? extensions = null)
    {
        var all = new Dictionary<string, object?>(extensions ?? []) { ["code"] = code };
        return TypedResults.Problem(detail, statusCode: status, title: title, type: TypeFor(code), extensions: all);
    }

    public static ProblemHttpResult NotFound(string code, string title, string? detail = null) =>
        Create(StatusCodes.Status404NotFound, code, title, detail);

    public static string TypeFor(string code) => $"urn:polivalko:problem:{code}";
}
