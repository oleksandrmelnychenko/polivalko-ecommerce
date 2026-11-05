using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Content.Features.Site;

internal static class ConsoleSiteEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var site = console.MapGroup("/site").WithTags("Console").RequireStaff();

        site.MapGet("/home", GetHomeSettings.HandleAsync)
            .RequirePermission(PermissionKeys.SiteHomeManage)
            .WithName("ConsoleGetHomeSettings")
            .WithSummary("Налаштування головної: блоки, оголошення, переваги, кроки, блок магазину");
        site.MapPut("/home", SaveHomeSettings.HandleAsync)
            .RequirePermission(PermissionKeys.SiteHomeManage)
            .WithName("ConsoleSaveHomeSettings")
            .WithSummary("Зміна налаштувань головної");

        site.MapGet("/banners", ListBanners.HandleAsync)
            .RequirePermission(PermissionKeys.SiteHomeManage)
            .WithName("ConsoleListBanners")
            .WithSummary("Банери першого екрана в порядку показу, разом із вимкненими й завершеними");
        site.MapPost("/banners", CreateBanner.HandleAsync)
            .RequirePermission(PermissionKeys.SiteHomeManage)
            .WithName("ConsoleCreateBanner")
            .WithSummary("Новий банер (стає останнім)");
        site.MapPut("/banners/order", ReorderBanners.HandleAsync)
            .RequirePermission(PermissionKeys.SiteHomeManage)
            .WithName("ConsoleReorderBanners")
            .WithSummary("Новий порядок банерів: усі id по черзі; повертає список");
        site.MapPut("/banners/{id:guid}", UpdateBanner.HandleAsync)
            .RequirePermission(PermissionKeys.SiteHomeManage)
            .WithName("ConsoleUpdateBanner")
            .WithSummary("Зміна банера: тексти, посилання, фото, період, увімкнення")
            .ProducesProblem(StatusCodes.Status404NotFound);
        site.MapDelete("/banners/{id:guid}", DeleteBanner.HandleAsync)
            .RequirePermission(PermissionKeys.SiteHomeManage)
            .WithName("ConsoleDeleteBanner")
            .WithSummary("Видалення банера")
            .ProducesProblem(StatusCodes.Status404NotFound);

        site.MapGet("/seo-templates", GetSeoTemplates.HandleAsync)
            .RequirePermission(PermissionKeys.SiteSeoManage)
            .WithName("ConsoleGetSeoTemplates")
            .WithSummary("Мета-шаблони товарів і категорій: {name}, {price}, {category}, {brand}, {shop}");
        site.MapPut("/seo-templates", SaveSeoTemplates.HandleAsync)
            .RequirePermission(PermissionKeys.SiteSeoManage)
            .WithName("ConsoleSaveSeoTemplates")
            .WithSummary("Зміна мета-шаблонів; діють для товарів і категорій без власних SEO-полів");

        return console;
    }
}
