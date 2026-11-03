namespace PoliValko.IntegrationTests;

public sealed record ProblemBody(
    string? Type,
    string? Title,
    int? Status,
    string? Detail,
    string? Code,
    string? TraceId,
    Dictionary<string, string[]>? Errors);
