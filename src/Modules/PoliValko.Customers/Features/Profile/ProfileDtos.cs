namespace PoliValko.Customers.Features.Profile;

public sealed record UpdateProfileRequest(string? Name, string? Phone);

public sealed record ChangeCustomerPasswordRequest(string? CurrentPassword, string? NewPassword);
