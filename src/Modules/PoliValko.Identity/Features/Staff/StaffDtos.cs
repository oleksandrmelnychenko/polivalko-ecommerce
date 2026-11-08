namespace PoliValko.Identity.Features.Staff;

public sealed record StaffUserDto(string Id, string Email, string DisplayName, string RoleId, string RoleName, bool LockedOut, bool TwoFactorEnabled);

public sealed record CreateStaffUserRequest(string? Email, string? DisplayName, string? RoleId, string? Password, string? TwoFactorCode = null);

public sealed record UpdateStaffUserRequest(string? DisplayName, string? RoleId, string? TwoFactorCode = null);

public sealed record LockStaffUserRequest(bool Locked);

public sealed record ResetPasswordRequest(string? Password);

public sealed record ResetStaffTwoFactorRequest(string? TwoFactorCode);

public sealed record ChangeOwnPasswordRequest(string? CurrentPassword, string? NewPassword);
