namespace PoliValko.Console.Features.Summary;

public sealed record ConsoleSummaryDto(
    int NewOrders,
    int AwaitingPayment,
    int AwaitingConfirmation,
    int NewServiceRequests,
    int PendingRefunds,
    int FailedOperations,
    bool CatalogDataFresh,
    DateTimeOffset? LastPriceSync);
