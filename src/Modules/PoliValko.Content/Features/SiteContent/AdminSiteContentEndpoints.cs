using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;

namespace PoliValko.Content.Features.SiteContent;

internal static class AdminSiteContentEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder admin)
    {
        var content = admin.MapGroup("/content").WithTags("Admin").RequireStaff(StaffPolicies.Admin);

        content.MapGet("/pages", ListPages.HandleAsync)
            .WithName("AdminListPages")
            .WithSummary("Текстові сторінки");
        content.MapGet("/pages/{slug}", GetPage.HandleAsync)
            .WithName("AdminGetPage")
            .WithSummary("Текстова сторінка для редагування")
            .ProducesProblem(StatusCodes.Status404NotFound);
        content.MapPut("/pages/{slug}", SavePage.HandleAsync)
            .WithName("AdminSavePage")
            .WithSummary("Зміна тексту сторінки; HTML очищається від небезпечної розмітки")
            .ProducesProblem(StatusCodes.Status404NotFound);

        content.MapGet("/contacts", GetContacts.HandleAsync)
            .WithName("AdminGetContacts")
            .WithSummary("Контакти магазину");
        content.MapPut("/contacts", SaveContacts.HandleAsync)
            .WithName("AdminSaveContacts")
            .WithSummary("Зміна контактів магазину");

        content.MapGet("/services", ListServiceDirections.HandleAsync)
            .WithName("AdminListServiceDirections")
            .WithSummary("Напрямки послуг з описами");
        content.MapPut("/services/{code}", SaveServiceDirection.HandleAsync)
            .WithName("AdminSaveServiceDirection")
            .WithSummary("Опис, порядок і видимість напрямку послуг")
            .ProducesProblem(StatusCodes.Status404NotFound);

        return admin;
    }
}
