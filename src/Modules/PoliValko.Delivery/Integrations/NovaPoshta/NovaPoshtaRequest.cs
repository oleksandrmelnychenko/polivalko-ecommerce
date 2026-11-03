namespace PoliValko.Delivery.Integrations.NovaPoshta;

internal sealed record NovaPoshtaRequest(
    string ApiKey,
    string ModelName,
    string CalledMethod,
    Dictionary<string, string> MethodProperties);
