using System.Net.Mail;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;
using PoliValko.Infrastructure.Audit;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Settings;
using PoliValko.Infrastructure.Storefront;
using PoliValko.Ordering.Configuration;

namespace PoliValko.Ordering.Features.Shop;

internal static partial class SaveShopSettings
{
    public const int NameLength = 200;
    public const int AddressLength = 300;
    public const int EmailLength = 200;
    public const int PhoneLength = 30;
    public const int LabelLength = 60;
    public const int HoursLength = 60;
    public const int MaxSpecialDays = 100;

    public static async Task<Results<Ok<ShopSettingsDto>, ValidationProblem>> HandleAsync(
        ShopSettingsDto request,
        ISettingsStore settings,
        IOptions<SellerOptions> sellerOptions,
        IAuditLog audit,
        IStorefrontCache storefront,
        HttpContext http,
        CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var seller = Seller(errors, request.Seller);
        var days = SpecialDays(errors, request.SpecialDays);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var value = new ShopSettingsDto(seller, days);
        var before = await ShopSettingsStore.LoadAsync(settings, sellerOptions.Value, ct);
        audit.Record("settings.shop_updated", "ShopSettings", null, new { before, after = value });
        await settings.SaveAsync(ShopSettingsStore.SettingsKey, value, http.User.StaffName(), ct);
        await storefront.InvalidateAsync([StorefrontTags.Content], ct);
        return TypedResults.Ok(value);
    }

    private static ShopSellerDto Seller(Dictionary<string, string[]> errors, ShopSellerDto? request)
    {
        var name = Clean(request?.Name) ?? string.Empty;
        if (name.Length is 0 or > NameLength)
        {
            errors["seller.name"] = [$"Вкажіть назву продавця до {NameLength} символів."];
        }

        var taxId = Clean(Whitespace().Replace(request?.TaxId ?? string.Empty, string.Empty));
        if (taxId is not null && !TaxId().IsMatch(taxId))
        {
            errors["seller.taxId"] = ["Вкажіть ЄДРПОУ (8 цифр) або РНОКПП (10 цифр)."];
        }

        var address = Clean(request?.Address);
        if (address is { Length: > AddressLength })
        {
            errors["seller.address"] = [$"Адреса має бути не довшою за {AddressLength} символів."];
        }

        var iban = Clean(Whitespace().Replace(request?.Iban ?? string.Empty, string.Empty).ToUpperInvariant());
        if (iban is not null && !Iban().IsMatch(iban))
        {
            errors["seller.iban"] = ["IBAN має складатися з літер UA і 27 цифр."];
        }

        var email = Clean(request?.Email);
        if (email is not null && (email.Length > EmailLength || !MailAddress.TryCreate(email, out _)))
        {
            errors["seller.email"] = ["Перевірте email."];
        }

        var phone = Clean(request?.Phone);
        if (phone is { Length: > PhoneLength })
        {
            errors["seller.phone"] = [$"Телефон має бути не довшим за {PhoneLength} символів."];
        }

        return new ShopSellerDto(name, taxId, address, iban, email, phone);
    }

    private static List<ShopSpecialDayDto> SpecialDays(Dictionary<string, string[]> errors, IReadOnlyList<ShopSpecialDayDto>? request)
    {
        var list = (request ?? []).Where(d => d is not null).ToList();
        if (list.Count > MaxSpecialDays)
        {
            errors["specialDays"] = [$"Не більше {MaxSpecialDays} особливих днів."];
        }

        var seen = new HashSet<DateOnly>();
        var days = new List<ShopSpecialDayDto>(list.Count);
        for (var i = 0; i < list.Count; i++)
        {
            var day = list[i];
            if (day.Date == default)
            {
                errors[$"specialDays[{i}].date"] = ["Вкажіть дату."];
            }
            else if (!seen.Add(day.Date))
            {
                errors[$"specialDays[{i}].date"] = ["Ця дата вже є в списку."];
            }

            var label = Clean(day.Label) ?? string.Empty;
            if (label.Length is 0 or > LabelLength)
            {
                errors[$"specialDays[{i}].label"] = [$"Вкажіть, що це за день (до {LabelLength} символів)."];
            }

            var hours = day.Closed ? null : Clean(day.Hours);
            if (!day.Closed && (hours is null || hours.Length > HoursLength))
            {
                errors[$"specialDays[{i}].hours"] = [$"Вкажіть години до {HoursLength} символів або позначте «Зачинено»."];
            }

            days.Add(new ShopSpecialDayDto(day.Date, label, day.Closed, hours));
        }

        return days.OrderBy(d => d.Date).ToList();
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();

    [GeneratedRegex(@"^(\d{8}|\d{10})$")]
    private static partial Regex TaxId();

    [GeneratedRegex(@"^UA\d{27}$")]
    private static partial Regex Iban();
}
