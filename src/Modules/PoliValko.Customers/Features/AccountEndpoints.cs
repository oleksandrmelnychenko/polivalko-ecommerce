using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Features.Addresses;
using PoliValko.Customers.Features.Auth;
using PoliValko.Customers.Features.Confirmation;
using PoliValko.Customers.Features.Profile;
using PoliValko.Customers.Features.Recovery;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;

namespace PoliValko.Customers.Features;

internal static class AccountEndpoints
{
    public static IEndpointRouteBuilder Map(IEndpointRouteBuilder api)
    {
        var account = api.MapGroup("/account").WithTags("Account");

        account.MapGet("/csrf", GetAccountCsrfToken.Handle)
            .WithName("AccountCsrf")
            .WithSummary("Токен для заголовка X-CSRF-TOKEN; отримуйте заново після реєстрації, входу й виходу");

        account.MapPost("/register", Register.HandleAsync)
            .RequireCsrf()
            .RequireRateLimiting(RateLimitPolicies.Forms)
            .WithName("AccountRegister")
            .WithSummary("Реєстрація покупця за email і паролем; одразу входить і надсилає лист для підтвердження email")
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        account.MapPost("/login", Login.HandleAsync)
            .RequireCsrf()
            .RequireRateLimiting(RateLimitPolicies.Login)
            .WithName("AccountLogin")
            .WithSummary("Вхід покупця; встановлює cookie pv_customer. Після 5 невдалих спроб вхід блокується на 15 хвилин")
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        account.MapPost("/logout", Logout.HandleAsync)
            .RequireCsrf()
            .WithName("AccountLogout")
            .WithSummary("Вихід покупця");

        account.MapPost("/email/confirm", ConfirmEmail.HandleAsync)
            .RequireAuthorization(CustomerPolicies.Customer)
            .RequireCsrf()
            .RequireRateLimiting(RateLimitPolicies.Login)
            .WithName("AccountConfirmEmail")
            .WithSummary("Підтвердження email за токеном з листа; попередні гостьові замовлення з цим email з'являються в кабінеті")
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        account.MapPost("/password/forgot", ForgotPassword.HandleAsync)
            .RequireCsrf()
            .RequireRateLimiting(RateLimitPolicies.Forms)
            .WithName("AccountForgotPassword")
            .WithSummary("Лист для відновлення пароля; відповідь однакова незалежно від того, чи є такий обліковий запис")
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        account.MapPost("/password/reset", ResetPassword.HandleAsync)
            .RequireCsrf()
            .RequireRateLimiting(RateLimitPolicies.Login)
            .WithName("AccountResetPassword")
            .WithSummary("Новий пароль за токеном з листа; завершує всі сесії й знімає блокування входу")
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        var customer = account.MapGroup(string.Empty).RequireCustomer();

        customer.MapGet("/me", GetMe.HandleAsync)
            .WithName("AccountMe")
            .WithSummary("Поточний покупець");

        customer.MapPut("/profile", UpdateProfile.HandleAsync)
            .WithName("AccountUpdateProfile")
            .WithSummary("Ім'я та телефон покупця");

        customer.MapPost("/password", ChangePassword.HandleAsync)
            .RequireRateLimiting(RateLimitPolicies.Login)
            .WithName("AccountChangePassword")
            .WithSummary("Зміна пароля; інші сесії покупця завершуються, поточна лишається")
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        customer.MapPost("/email/resend", ResendConfirmation.HandleAsync)
            .RequireRateLimiting(RateLimitPolicies.Forms)
            .WithName("AccountResendConfirmation")
            .WithSummary("Повторний лист для підтвердження email")
            .ProducesProblem(StatusCodes.Status429TooManyRequests)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        AddressEndpoints.Map(customer);
        return api;
    }
}
