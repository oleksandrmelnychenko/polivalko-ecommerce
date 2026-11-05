using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Security.Permissions;

namespace PoliValko.Ordering.Features.Shop;

internal static class ShopSettingsEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var shop = console.MapGroup("/settings/shop").WithTags("Console").RequireStaff(PermissionKeys.SettingsShopManage);

        shop.MapGet(string.Empty, GetShopSettings.HandleAsync)
            .WithName("ConsoleGetShopSettings")
            .WithSummary("Реквізити продавця й особливі дні графіка; поки реквізити не збережено — з конфігурації сервера");
        shop.MapPut(string.Empty, SaveShopSettings.HandleAsync)
            .WithName("ConsoleSaveShopSettings")
            .WithSummary("Зміна реквізитів продавця (оферта, замовлення, підвал сайту) й особливих днів графіка");

        return console;
    }
}
