using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Identity.Features.TwoFactor;

internal static class TwoFactorEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var own = console.MapGroup("/auth/two-factor").WithTags("Console").RequireStaff();
        own.MapGet(string.Empty, OwnTwoFactor.StatusAsync)
            .WithName("ConsoleTwoFactorStatus")
            .WithSummary("Чи ввімкнено двофакторну перевірку і скільки лишилось резервних кодів");
        own.MapPost("/setup", OwnTwoFactor.SetupAsync)
            .WithName("ConsoleTwoFactorSetup")
            .WithSummary("Новий ключ для застосунку-автентифікатора")
            .ProducesProblem(StatusCodes.Status409Conflict);
        own.MapPost("/enable", OwnTwoFactor.EnableAsync)
            .WithName("ConsoleTwoFactorEnable")
            .WithSummary("Увімкнути перевірку кодом із застосунку; повертає резервні коди")
            .ProducesProblem(StatusCodes.Status409Conflict);
        own.MapPost("/recovery-codes", OwnTwoFactor.RegenerateRecoveryCodesAsync)
            .WithName("ConsoleTwoFactorRecoveryCodes")
            .WithSummary("Нові резервні коди замість попередніх")
            .ProducesProblem(StatusCodes.Status409Conflict);
        own.MapPost("/disable", OwnTwoFactor.DisableAsync)
            .WithName("ConsoleTwoFactorDisable")
            .WithSummary("Вимкнути власну двофакторну перевірку")
            .ProducesProblem(StatusCodes.Status409Conflict);
        return console;
    }
}
