using System.Buffers.Binary;
using System.Security.Cryptography;

namespace PoliValko.Ordering.Features.Checkout;

/// <summary>
/// Order numbers like «PV-48271593»: eight digits that do not show how many orders the shop takes. Consecutive
/// numbers (PV-100231, PV-100232) let anyone who orders twice read the shop's volume off the difference.
/// </summary>
/// <remarks>
/// The database sequence still counts orders; its value is scrambled by a keyed permutation of the eight-digit
/// numbers (a Feistel network over two four-digit halves, walked until it lands on eight digits). A permutation
/// never gives two orders one number, so there is nothing to check or retry. Earlier orders keep their
/// six-digit numbers, which no eight-digit number can equal. «PV-» followed by digits is what the analytics service
/// and the DNTrade exchange recognise as a site order, so no separator goes between the digits.
/// Changing <see cref="Key"/> or the rounds would give new orders numbers already used: never change them.
/// </remarks>
internal static class OrderNumbers
{
    private const int Half = 10_000;
    private const long Smallest = 10_000_000;
    private const long Count = (long)Half * Half;
    private const int Rounds = 6;
    private static readonly byte[] Key = "poli-valko/order-numbers/v1:3f9c1a7e5b2d4086"u8.ToArray();

    public static string From(long sequence)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(sequence);
        ArgumentOutOfRangeException.ThrowIfGreaterThanOrEqual(sequence, Count - Smallest);
        // Cycle walking: the permutation covers 0…99 999 999; stepping on from a number below eight digits stays a
        // permutation of the eight-digit ones.
        var value = Smallest + sequence;
        do value = Permute(value);
        while (value < Smallest);
        return $"PV-{value}";
    }

    private static long Permute(long value)
    {
        var left = (int)(value / Half);
        var right = (int)(value % Half);
        for (var round = 0; round < Rounds; round++)
        {
            var next = (left + Scramble(round, right)) % Half;
            left = right;
            right = next;
        }

        return (long)left * Half + right;
    }

    private static int Scramble(int round, int half)
    {
        Span<byte> input = stackalloc byte[5];
        input[0] = (byte)round;
        BinaryPrimitives.WriteInt32BigEndian(input[1..], half);
        Span<byte> hash = stackalloc byte[32];
        HMACSHA256.HashData(Key, input, hash);
        return (int)(BinaryPrimitives.ReadUInt32BigEndian(hash) % Half);
    }
}
