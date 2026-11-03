using Microsoft.AspNetCore.Http.HttpResults;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Ordering.Contracts;

public static class OrderProblems
{
    public static ProblemHttpResult NotFound() =>
        Problems.NotFound("ordering.order_not_found", "Замовлення не знайдено", "Перевірте посилання на сторінку замовлення.");
}
