namespace PoliValko.Customers.Features.Recovery;

public sealed record ForgotPasswordRequest(string? Email);

public sealed record ResetCustomerPasswordRequest(string? Token, string? NewPassword);
