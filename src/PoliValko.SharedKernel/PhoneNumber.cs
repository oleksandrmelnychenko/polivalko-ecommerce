namespace PoliValko.SharedKernel;

public static class PhoneNumber
{
    /// <summary>
    /// Приводить український мобільний або міський номер до формату E.164 (+380XXXXXXXXX).
    /// Приймає "+380 67 123 45 67", "067-123-45-67", "380671234567", "(067) 123 45 67".
    /// </summary>
    public static bool TryNormalizeUa(string? input, out string normalized)
    {
        normalized = string.Empty;
        if (string.IsNullOrWhiteSpace(input))
        {
            return false;
        }

        var trimmed = input.Trim();
        if (trimmed.Any(c => !(char.IsAsciiDigit(c) || c is '+' or ' ' or '-' or '(' or ')')))
        {
            return false;
        }

        var digits = new string(trimmed.Where(char.IsAsciiDigit).ToArray());
        var national = digits switch
        {
            { Length: 12 } when digits.StartsWith("380", StringComparison.Ordinal) => digits[3..],
            { Length: 10 } when digits.StartsWith('0') => digits[1..],
            { Length: 9 } => digits,
            _ => null,
        };

        if (national is null || national.StartsWith('0'))
        {
            return false;
        }

        normalized = "+380" + national;
        return true;
    }
}
