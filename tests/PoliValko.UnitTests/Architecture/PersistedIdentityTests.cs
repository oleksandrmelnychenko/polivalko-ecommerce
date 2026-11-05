using System.Reflection;
using PoliValko.Delivery.Contracts;
using PoliValko.Infrastructure.Outbox;
using PoliValko.Navkolo.Contracts;
using PoliValko.Ordering.Contracts;
using PoliValko.Payments.Contracts;

namespace PoliValko.UnitTests.Architecture;

public sealed class PersistedIdentityTests
{
    private static readonly Dictionary<string, string> MessageTypes = new(StringComparer.Ordinal)
    {
        ["OrderPlaced"] = "ordering.order-placed",
        ["PaymentSucceeded"] = "ordering.payment-succeeded",
        ["OrderPaidAfterCancel"] = "ordering.paid-after-cancel",
        ["OrderExportRequested"] = "ordering.export-requested",
        ["FiscalReceiptRequested"] = "ordering.fiscal-receipt-requested",
        ["RefundRequested"] = "ordering.refund-requested",
        ["ServiceRequestSubmitted"] = "content.service-request-submitted",
        ["IntegrationAlert"] = "integration.alert",
    };

    private static readonly Dictionary<string, string[]> MessageProperties = new(StringComparer.Ordinal)
    {
        ["OrderPlaced"] = ["OrderId"],
        ["PaymentSucceeded"] = ["OrderId"],
        ["OrderPaidAfterCancel"] = ["OrderId"],
        ["OrderExportRequested"] = ["OrderId"],
        ["FiscalReceiptRequested"] = ["OrderId", "Trigger", "RefundId"],
        ["RefundRequested"] = ["OrderId", "RefundId"],
        ["ServiceRequestSubmitted"] = ["ServiceRequestId"],
        ["IntegrationAlert"] = ["Title", "Body"],
    };

    [Fact]
    public void Outbox_message_types_keep_their_stored_names()
    {
        var actual = OutboxMessages().ToDictionary(
            type => type.Name,
            type => (string)type.GetProperty(nameof(IOutboxMessage.Type), BindingFlags.Public | BindingFlags.Static)!.GetValue(null)!,
            StringComparer.Ordinal);

        actual.OrderBy(pair => pair.Key, StringComparer.Ordinal)
            .ShouldBe(MessageTypes.OrderBy(pair => pair.Key, StringComparer.Ordinal));
    }

    [Fact]
    public void Outbox_payloads_keep_their_property_names()
    {
        var actual = OutboxMessages().ToDictionary(
            type => type.Name,
            type => type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .OrderBy(property => property.MetadataToken)
                .Select(property => property.Name)
                .ToArray(),
            StringComparer.Ordinal);

        actual.Keys.Order(StringComparer.Ordinal).ShouldBe(MessageProperties.Keys.Order(StringComparer.Ordinal));
        foreach (var (name, properties) in MessageProperties)
        {
            actual[name].ShouldBe(properties, name);
        }
    }

    [Fact]
    public void Fiscal_trigger_keeps_its_numeric_values()
    {
        Enum.GetValues<FiscalTrigger>()
            .ToDictionary(trigger => trigger.ToString(), trigger => (int)trigger)
            .ShouldBe(new Dictionary<string, int> { ["Payment"] = 0, ["Completion"] = 1, ["Refund"] = 2 });
    }

    [Fact]
    public void Sync_job_names_are_unchanged()
    {
        NavkoloJobs.PriceStock.ShouldBe("navkolo.price-stock");
        NavkoloJobs.Catalog.ShouldBe("navkolo.catalog");
        NavkoloJobs.Import.ShouldBe("navkolo.import");
        DeliveryJobs.NovaPoshtaDirectory.ShouldBe("novaposhta.directory");
        PaymentJobs.Reconcile.ShouldBe("payments.reconcile");
    }

    private static List<Type> OutboxMessages() =>
        SolutionAssemblies.Source
            .SelectMany(assembly => assembly.GetTypes())
            .Where(type => type is { IsAbstract: false, IsInterface: false } && typeof(IOutboxMessage).IsAssignableFrom(type))
            .ToList();
}
