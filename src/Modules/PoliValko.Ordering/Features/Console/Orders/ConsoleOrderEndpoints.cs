using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using PoliValko.Infrastructure.Idempotency;
using PoliValko.Infrastructure.Security;
using PoliValko.Infrastructure.Web;
using PoliValko.Ordering.Contracts;

namespace PoliValko.Ordering.Features.Console.Orders;

internal static class ConsoleOrderEndpoints
{
    public static RouteGroupBuilder Map(RouteGroupBuilder console)
    {
        var group = console.MapGroup("/orders").WithTags("Console").RequireStaff();

        group.MapGet(string.Empty, ListOrders.HandleAsync)
            .WithName("ConsoleListOrders")
            .WithEnumQuery<OrderStatus>("status")
            .WithEnumQuery<PaymentStatus>("paymentStatus")
            .WithSummary("Замовлення: пошук за номером або телефоном, фільтри за статусом, оплатою, способом отримання й датами");

        group.MapGet("/counts", CountOrders.HandleAsync)
            .WithName("ConsoleOrderCounts")
            .WithEnumQuery<PaymentStatus>("paymentStatus")
            .WithSummary("Кількість замовлень за статусами з тими самими фільтрами, що й у списку");

        group.MapGet("/export", ExportOrders.HandleAsync)
            .WithName("ConsoleExportOrders")
            .WithEnumQuery<OrderStatus>("status")
            .WithEnumQuery<PaymentStatus>("paymentStatus")
            .Produces<string>(StatusCodes.Status200OK, "text/csv")
            .WithSummary("Вивантаження замовлень у CSV для Excel (UTF-8 з BOM, роздільник «;», до 5000 рядків)");

        group.MapGet("/{number}", GetConsoleOrder.HandleAsync)
            .WithName("ConsoleGetOrder")
            .WithSummary("Картка замовлення з історією обробки, поверненнями й передачею в Navkolo")
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/{number}/status", ChangeOrderStatus.HandleAsync)
            .WithName("ConsoleChangeOrderStatus")
            .WithSummary("Зміна статусу за таблицею переходів. Статус оплати тут не змінюється.")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/{number}/refunds", CreateRefund.HandleAsync)
            .RequireIdempotency<CreateRefundRequest>()
            .WithName("ConsoleCreateRefund")
            .WithSummary("Повне або часткове повернення за позиціями: на картку через провайдера або фіксація готівкового повернення")
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return console;
    }
}
