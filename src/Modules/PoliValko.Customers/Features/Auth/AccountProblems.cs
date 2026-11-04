using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Customers.Features.Auth;

internal static class AccountProblems
{
    public const string InvalidLink = "Посилання недійсне або застаріле. Запросіть новий лист.";

    public static ProblemHttpResult SignedOut() =>
        Problems.Create(StatusCodes.Status401Unauthorized, "auth.unauthorized", "Потрібен вхід", "Увійдіть до особистого кабінету.");

    public static ValidationProblem InvalidToken() =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { ["token"] = [InvalidLink] });
}
