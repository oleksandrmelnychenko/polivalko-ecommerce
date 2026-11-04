using System.Security.Claims;
using PoliValko.Customers.Contracts;
using PoliValko.Customers.Domain;
using PoliValko.Customers.Features.Auth;
using PoliValko.Ordering.Contracts;

namespace PoliValko.UnitTests;

public sealed class CustomerRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 4, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Saved_address_codes_match_checkout_delivery_codes()
    {
        AddressDeliveryCodes.NovaPoshta.ShouldBe(DeliveryCodes.NovaPoshta);
        AddressDeliveryCodes.NovaPoshtaCourier.ShouldBe(DeliveryCodes.NovaPoshtaCourier);
        AddressDeliveryCodes.All.ShouldAllBe(code => DeliveryCodes.Parse(code) != null);
    }

    [Fact]
    public void Fifth_failed_login_locks_the_account_for_fifteen_minutes()
    {
        var customer = NewCustomer();
        for (var i = 1; i < Customer.MaxFailedLogins; i++)
        {
            customer.RecordFailedLogin(Now);
            customer.IsLockedOut(Now).ShouldBeFalse();
        }

        customer.RecordFailedLogin(Now);
        customer.IsLockedOut(Now).ShouldBeTrue();
        customer.IsLockedOut(Now.AddMinutes(15)).ShouldBeFalse();
        customer.FailedLoginCount.ShouldBe(0);

        customer.ClearLockout();
        customer.IsLockedOut(Now).ShouldBeFalse();
    }

    [Fact]
    public void Password_change_rotates_the_security_stamp_but_rehash_does_not()
    {
        var customer = NewCustomer();
        var stamp = customer.SecurityStamp;

        customer.RehashPassword("rehashed");
        customer.SecurityStamp.ShouldBe(stamp);

        customer.ChangePassword("changed");
        customer.SecurityStamp.ShouldNotBe(stamp);
        customer.PasswordHash.ShouldBe("changed");
    }

    [Fact]
    public void Tokens_are_random_hashed_and_expire_by_purpose()
    {
        var (confirmation, value) = CustomerToken.Issue(Guid.NewGuid(), CustomerTokenPurpose.EmailConfirmation, Now);
        var (reset, other) = CustomerToken.Issue(Guid.NewGuid(), CustomerTokenPurpose.PasswordReset, Now);

        value.Length.ShouldBe(43);
        value.ShouldNotBe(other);
        value.ShouldAllBe(c => char.IsAsciiLetterOrDigit(c) || c == '-' || c == '_');
        confirmation.TokenHash.ShouldBe(CustomerToken.Hash(value));
        confirmation.TokenHash.ShouldNotContain(value);
        confirmation.ExpiresAt.ShouldBe(Now.AddDays(3));
        reset.ExpiresAt.ShouldBe(Now.AddHours(1));

        reset.IsUsable(Now.AddMinutes(59)).ShouldBeTrue();
        reset.IsUsable(Now.AddHours(1)).ShouldBeFalse();
        reset.UsedAt = Now;
        reset.IsUsable(Now).ShouldBeFalse();
    }

    [Theory]
    [InlineData(null, "Пароль має містити від 8 до 128 символів.")]
    [InlineData("1234567", "Пароль має містити від 8 до 128 символів.")]
    [InlineData("OLENA@example.com", "Пароль не може збігатися з email.")]
    [InlineData("12345678", null)]
    public void Password_rules(string? password, string? error)
    {
        var errors = new Dictionary<string, string[]>();
        CustomerValidation.Password(password, "olena@example.com", "password", errors);
        if (error is null)
        {
            errors.ShouldBeEmpty();
        }
        else
        {
            errors["password"].ShouldBe([error]);
        }
    }

    [Fact]
    public void Customer_id_is_read_only_from_a_customer_identity()
    {
        var id = Guid.NewGuid();
        CustomerSession.CreatePrincipal(id, "olena@example.com", "Олена", "stamp").CustomerId().ShouldBe(id);

        var staff = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, id.ToString())], "Identity.Application"));
        staff.CustomerId().ShouldBeNull();
        new ClaimsPrincipal(new ClaimsIdentity()).CustomerId().ShouldBeNull();
    }

    private static Customer NewCustomer() => new()
    {
        Id = Guid.NewGuid(),
        Email = "olena@example.com",
        NormalizedEmail = CustomerEmail.Normalize("olena@example.com"),
        Name = "Олена",
        CreatedAt = Now,
    };
}
