namespace PoliValko.Identity.Features.Staff;

public sealed record StaffUserDto(string Id, string Email, string DisplayName, IReadOnlyList<string> Roles, bool LockedOut);

public sealed record CreateStaffUserRequest(string? Email, string? DisplayName, string? Role, string? Password);

public sealed record UpdateStaffUserRequest(string? DisplayName, string? Role);

public sealed record LockStaffUserRequest(bool Locked);

public sealed record ResetPasswordRequest(string? Password);

public sealed record ChangeOwnPasswordRequest(string? CurrentPassword, string? NewPassword);
