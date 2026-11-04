using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Content.Features.SiteContent;

internal static class ConsoleSiteContentEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var content = console.MapGroup("/content").WithTags("Console").RequireStaff(StaffPolicies.Admin);

        content.MapGet("/pages", ListPages.HandleAsync)
            .WithName("ConsoleListPages")
            .WithSummary("Текстові сторінки");
        content.MapGet("/pages/{slug}", GetPage.HandleAsync)
            .WithName("ConsoleGetPage")
            .WithSummary("Текстова сторінка для редагування")
            .ProducesProblem(StatusCodes.Status404NotFound);
        content.MapPut("/pages/{slug}", SavePage.HandleAsync)
            .WithName("ConsoleSavePage")
            .WithSummary("Зміна тексту сторінки; HTML очищається від небезпечної розмітки")
            .ProducesProblem(StatusCodes.Status404NotFound);

        content.MapGet("/contacts", GetContacts.HandleAsync)
            .WithName("ConsoleGetContacts")
            .WithSummary("Контакти магазину");
        content.MapPut("/contacts", SaveContacts.HandleAsync)
            .WithName("ConsoleSaveContacts")
            .WithSummary("Зміна контактів магазину");

        content.MapGet("/services", ListServiceDirections.HandleAsync)
            .WithName("ConsoleListServiceDirections")
            .WithSummary("Напрямки послуг з описами");
        content.MapPut("/services/{code}", SaveServiceDirection.HandleAsync)
            .WithName("ConsoleSaveServiceDirection")
            .WithSummary("Опис, порядок і видимість напрямку послуг")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return console;
    }
}
