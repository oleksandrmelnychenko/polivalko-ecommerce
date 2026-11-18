using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Notifications.Contracts;

namespace PoliValko.Notifications.Features.Mail;

public sealed record CustomerMailStatusDto(bool Delivers);

internal static class CustomerMailEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        api.MapGet("/customer-mail", (ICustomerMailer mailer) => TypedResults.Ok(new CustomerMailStatusDto(mailer.Delivers)))
            .WithTags("Site")
            .WithName("GetCustomerMailStatus")
            .WithSummary("Чи доставляються листи покупцям: від цього залежать тексти про лист із посиланням, підтвердження email і відновлення пароля");
        return api;
    }
}
