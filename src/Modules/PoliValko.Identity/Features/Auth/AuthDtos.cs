namespace PoliValko.Identity.Features.Auth;

public sealed record LoginRequest(string? Email, string? Password);

public sealed record StaffMeDto(string Email, string DisplayName, IReadOnlyList<string> Roles);

public sealed record CsrfTokenDto(string Token);
