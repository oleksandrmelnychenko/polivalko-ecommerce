namespace PoliValko.Customers.Domain;

public sealed class Customer
{
    public const int MaxFailedLogins = 5;

    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public Guid Id { get; init; }

    public required string Email { get; init; }

    public required string NormalizedEmail { get; init; }

    public string PasswordHash { get; private set; } = string.Empty;

    public required string Name { get; set; }

    public string? Phone { get; set; }

    public DateTimeOffset? EmailConfirmedAt { get; private set; }

    public DateTimeOffset CreatedAt { get; init; }

    public string SecurityStamp { get; private set; } = NewStamp();

    public int FailedLoginCount { get; private set; }

    public DateTimeOffset? LockoutEnd { get; private set; }

    public bool IsLockedOut(DateTimeOffset now) => LockoutEnd is { } end && end > now;

    public void ChangePassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        SecurityStamp = NewStamp();
    }

    public void RehashPassword(string passwordHash) => PasswordHash = passwordHash;

    public void RecordFailedLogin(DateTimeOffset now)
    {
        FailedLoginCount++;
        if (FailedLoginCount >= MaxFailedLogins)
        {
            LockoutEnd = now + LockoutDuration;
            FailedLoginCount = 0;
        }
    }

    public void ClearLockout()
    {
        FailedLoginCount = 0;
        LockoutEnd = null;
    }

    public bool ConfirmEmail(DateTimeOffset now)
    {
        if (EmailConfirmedAt is not null)
        {
            return false;
        }

        EmailConfirmedAt = now;
        return true;
    }

    private static string NewStamp() => Guid.NewGuid().ToString("N");
}
