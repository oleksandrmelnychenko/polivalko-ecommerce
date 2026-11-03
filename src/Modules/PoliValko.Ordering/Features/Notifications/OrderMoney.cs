using System.Globalization;

namespace PoliValko.Ordering.Features.Notifications;

internal static class OrderMoney
{
    public static string Money(decimal amount) => amount.ToString("N2", CultureInfo.GetCultureInfo("uk-UA")) + " грн";
}
