using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Customers.Features.Console;

internal static class ConsoleAccountEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var accounts = console.MapGroup("/accounts").WithTags("Console").RequireStaff(PermissionKeys.CustomersView);

        accounts.MapGet(string.Empty, ListAccounts.HandleAsync)
            .WithName("ConsoleListAccounts")
            .WithSummary("Зареєстровані покупці (кабінети): пошук за email, ім'ям чи телефоном, фільтр за станом");

        accounts.MapGet("/{id:guid}", GetAccount.HandleAsync)
            .WithName("ConsoleGetAccount")
            .WithSummary("Кабінет покупця: адреси, обране, останні замовлення")
            .ProducesProblem(StatusCodes.Status404NotFound);

        accounts.MapPost("/{id:guid}/lock", SetAccountLock.HandleAsync)
            .RequirePermission(PermissionKeys.CustomerAccountsManage)
            .WithName("ConsoleSetAccountLock")
            .WithSummary("Блокування кабінету (вхід заборонено, сесії завершуються) або розблокування")
            .ProducesProblem(StatusCodes.Status404NotFound);

        accounts.MapPost("/{id:guid}/password-reset", SendAccountPasswordReset.HandleAsync)
            .RequirePermission(PermissionKeys.CustomerAccountsManage)
            .WithName("ConsoleSendAccountPasswordReset")
            .WithSummary("Лист покупцю з посиланням для нового пароля (діє 1 годину)")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return console;
    }
}
