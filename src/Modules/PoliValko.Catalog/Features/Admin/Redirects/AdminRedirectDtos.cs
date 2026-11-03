namespace PoliValko.Catalog.Features.Admin.Redirects;

public sealed record AdminRedirectDto(Guid Id, string FromPath, string ToPath, bool IsAutomatic, DateTimeOffset CreatedAt);

public sealed record CreateRedirectRequest(string? FromPath, string? ToPath);
