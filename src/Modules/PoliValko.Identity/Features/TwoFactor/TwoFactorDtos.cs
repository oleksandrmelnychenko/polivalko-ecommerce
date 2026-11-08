namespace PoliValko.Identity.Features.TwoFactor;

public sealed record TwoFactorStatusDto(bool Enabled, int RecoveryCodesLeft);

public sealed record TwoFactorSetupDto(string SharedKey, string AuthenticatorUri);

public sealed record TwoFactorCodeRequest(string? Code);

public sealed record TwoFactorRecoveryCodesDto(IReadOnlyList<string> RecoveryCodes);
