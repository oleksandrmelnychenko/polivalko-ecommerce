namespace PoliValko.Admin.Features.Summary;

public sealed record AdminSummaryDto(
    int NewOrders,
    int AwaitingPayment,
    int AwaitingConfirmation,
    int NewServiceRequests,
    int PendingRefunds,
    int FailedOperations,
    bool CatalogDataFresh,
    DateTimeOffset? LastPriceSync);
