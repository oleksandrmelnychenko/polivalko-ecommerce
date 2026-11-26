using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using PoliValko.Fiscal.Configuration;
using PoliValko.Fiscal.Features.Settings;
using PoliValko.Fiscal.Integrations.Providers;

namespace PoliValko.Fiscal.Integrations.Checkbox;

internal sealed class CheckboxFiscalProvider(HttpClient http, IOptions<FiscalOptions> options, ICheckboxCredentials credentials) : IFiscalProvider
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    internal sealed record SignIn(string Login, string Password);

    internal sealed record Token(string AccessToken);

    internal sealed record Shift(Guid Id, string Status);

    internal sealed record Good(string Code, string Name, long Price);

    internal sealed record GoodLine(Good Good, int Quantity, bool? IsReturn);

    internal sealed record PaymentLine(string Type, long Value, string? Label);

    internal sealed record SellBody(Guid Id, IReadOnlyList<GoodLine> Goods, IReadOnlyList<PaymentLine> Payments, string? Header);

    internal sealed record ReceiptState(Guid Id, string Status, string? FiscalCode);

    public string Name => "checkbox";

    public async Task<IssuedReceipt> IssueAsync(ReceiptDraft draft, CancellationToken ct)
    {
        var token = await SignInAsync(ct);
        await EnsureShiftAsync(token, ct);

        var body = new SellBody(
            draft.Id,
            draft.Goods.Select(g => new GoodLine(new Good(g.Code, g.Name, Kopecks(g.UnitPrice)), g.Quantity * 1000, draft.IsReturn ? true : null)).ToList(),
            [new PaymentLine(draft.PaymentType, Kopecks(draft.Amount), draft.PaymentType == "CASHLESS" ? "Картка" : null)],
            $"Замовлення {draft.OrderNumber}");

        using (var response = await SendAsync(HttpMethod.Post, "/api/v1/receipts/sell", token, body, ct, allowConflict: true))
        {
        }

        for (var attempt = 0; attempt < 10; attempt++)
        {
            using var response = await SendAsync(HttpMethod.Get, $"/api/v1/receipts/{draft.Id}", token, null, ct);
            var state = await response.Content.ReadFromJsonAsync<ReceiptState>(Json, ct);
            if (state is { Status: "DONE" })
            {
                return new IssuedReceipt(state.Id.ToString(), state.FiscalCode, $"https://check.checkbox.ua/{state.Id}");
            }

            if (state is { Status: "ERROR" })
            {
                throw new InvalidOperationException("Checkbox не зміг фіскалізувати чек.");
            }

            await Task.Delay(TimeSpan.FromSeconds(2), ct);
        }

        throw new TimeoutException("Checkbox ще не повернув фіскальний код; спробуємо пізніше.");
    }

    internal sealed record CashRegister(string? FiscalNumber, string? Address);

    /// <summary>Checks the keys: the cashier signs in and the license key opens its cash register. Returns its fiscal number.</summary>
    public async Task<string> CheckAsync(CancellationToken ct)
    {
        var token = await SignInAsync(ct);
        using var response = await SendAsync(HttpMethod.Get, "/api/v1/cash-registers/info", token, null, ct);
        var register = await response.Content.ReadFromJsonAsync<CashRegister>(Json, ct);
        return register?.FiscalNumber ?? "без номера";
    }

    private async Task<CheckboxKeys> KeysAsync(CancellationToken ct) =>
        await credentials.CheckboxAsync(ct)
        ?? throw new InvalidOperationException("Не задано ключі Checkbox: вставте їх у консолі, розділ «Оплата й чеки» → «Каса».");

    private async Task<string> SignInAsync(CancellationToken ct)
    {
        var keys = await KeysAsync(ct);
        using var response = await SendAsync(HttpMethod.Post, "/api/v1/cashier/signin", null, new SignIn(keys.CashierLogin, keys.CashierPassword), ct);
        var token = await response.Content.ReadFromJsonAsync<Token>(Json, ct);
        return token?.AccessToken ?? throw new InvalidOperationException("Checkbox не повернув токен касира.");
    }

    private async Task EnsureShiftAsync(string token, CancellationToken ct)
    {
        using (var current = await SendAsync(HttpMethod.Get, "/api/v1/cashier/shift", token, null, ct, allowConflict: true))
        {
            if (current.IsSuccessStatusCode && current.Content.Headers.ContentLength != 0
                && await current.Content.ReadFromJsonAsync<Shift?>(Json, ct) is { Status: "OPENED" })
            {
                return;
            }
        }

        using var opened = await SendAsync(HttpMethod.Post, "/api/v1/shifts", token, new { }, ct, allowConflict: true);
        var shift = opened.IsSuccessStatusCode ? await opened.Content.ReadFromJsonAsync<Shift>(Json, ct) : null;
        for (var attempt = 0; shift is not null && shift.Status != "OPENED" && attempt < 10; attempt++)
        {
            await Task.Delay(TimeSpan.FromSeconds(2), ct);
            using var check = await SendAsync(HttpMethod.Get, $"/api/v1/shifts/{shift.Id}", token, null, ct);
            shift = await check.Content.ReadFromJsonAsync<Shift>(Json, ct);
        }
    }

    private async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, string? token, object? body, CancellationToken ct, bool allowConflict = false)
    {
        var keys = await KeysAsync(ct);
        using var request = new HttpRequestMessage(method, $"{options.Value.Checkbox.BaseUrl.TrimEnd('/')}{path}");
        request.Headers.Add("X-Client-Name", "PoliValko");
        request.Headers.Add("X-Client-Version", "1.0");
        request.Headers.Add("X-License-Key", keys.LicenseKey);

        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body, body.GetType(), options: Json);
        }

        var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode && !(allowConflict && (int)response.StatusCode is 400 or 404 or 409))
        {
            var text = await response.Content.ReadAsStringAsync(ct);
            response.Dispose();
            throw new HttpRequestException($"Checkbox {path}: {(int)response.StatusCode} {text}");
        }

        return response;
    }

    private static long Kopecks(decimal amount) => (long)decimal.Round(amount * 100, 0, MidpointRounding.AwayFromZero);
}
