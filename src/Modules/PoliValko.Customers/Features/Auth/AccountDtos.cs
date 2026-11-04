namespace PoliValko.Customers.Features.Auth;

public sealed record RegisterCustomerRequest(string? Email, string? Password, string? Name, string? Phone);

public sealed record CustomerLoginRequest(string? Email, string? Password);

public sealed record CustomerMeDto(Guid Id, string Email, bool EmailConfirmed, string Name, string? Phone);
