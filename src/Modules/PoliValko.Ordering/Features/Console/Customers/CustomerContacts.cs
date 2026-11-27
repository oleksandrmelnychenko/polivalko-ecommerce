using Microsoft.EntityFrameworkCore;
using PoliValko.Infrastructure.Persistence;

namespace PoliValko.Ordering.Features.Console.Customers;

internal static class CustomerContacts
{
    private sealed record ContactRow(string Phone, string Name, string? Email, string Number);

    public static async Task<Dictionary<string, CustomerContact>> LoadContactsAsync(
        PoliValkoDbContext db,
        IReadOnlyCollection<string> phones,
        CancellationToken ct)
    {
        if (phones.Count == 0)
        {
            return [];
        }

        var phoneArray = phones as string[] ?? phones.ToArray();
        var rows = await db.Database.SqlQuery<ContactRow>($"""
            SELECT DISTINCT ON (o.customer_phone)
                o.customer_phone AS phone,
                o.customer_name AS name,
                (
                    SELECT o2.customer_email
                    FROM ordering.orders o2
                    WHERE o2.customer_phone = o.customer_phone
                      AND nullif(btrim(o2.customer_email), '') IS NOT NULL
                    ORDER BY o2.created_at DESC, o2.id DESC
                    LIMIT 1
                ) AS email,
                o.number
            FROM ordering.orders o
            WHERE o.customer_phone = ANY({phoneArray})
            ORDER BY o.customer_phone, o.created_at DESC, o.id DESC
            """).ToListAsync(ct);

        return rows.ToDictionary(
            row => row.Phone,
            row => new CustomerContact(row.Name, row.Email, row.Number));
    }
}
