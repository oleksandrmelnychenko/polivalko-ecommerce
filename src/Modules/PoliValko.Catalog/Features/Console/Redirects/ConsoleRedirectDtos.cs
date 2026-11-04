namespace PoliValko.Catalog.Features.Console.Redirects;

public sealed record ConsoleRedirectDto(Guid Id, string FromPath, string ToPath, bool IsAutomatic, DateTimeOffset CreatedAt);

public sealed record CreateRedirectRequest(string? FromPath, string? ToPath);
