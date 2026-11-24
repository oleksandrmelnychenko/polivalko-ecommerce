using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace PoliValko.Infrastructure.Persistence.Migrations;

[DbContext(typeof(PoliValkoDbContext))]
[Migration("20261124220000_StorePickupContacts")]
public sealed class StorePickupContacts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        UPDATE content.contacts
        SET address = COALESCE((
            SELECT NULLIF(trim(address), '') FROM delivery.pickup_points
            WHERE code = 'bucha-store' AND address <> 'м. Буча (точну адресу надає замовник)'
        ), 'м. Буча, вул. Депутатська, 1-В, ТК «Варшавський», фасадний ряд, приміщення №8')
        WHERE id = 1 AND address = 'м. Буча, Київська обл. (точну адресу надає магазин)';

        UPDATE content.contacts
        SET schedule = COALESCE((
            SELECT NULLIF(trim(schedule), '') FROM delivery.pickup_points
            WHERE code = 'bucha-store' AND schedule <> 'Пн–Нд, 9:00–19:00 (уточнюється)'
        ), 'Пн–Сб 09:00–17:30, Нд — вихідний')
        WHERE id = 1 AND schedule = 'Пн–Нд, 9:00–19:00 (уточнюється)';

        UPDATE delivery.pickup_points AS p
        SET address = COALESCE(NULLIF(trim(c.address), ''), 'м. Буча, вул. Депутатська, 1-В, ТК «Варшавський», фасадний ряд, приміщення №8')
        FROM content.contacts AS c
        WHERE c.id = 1 AND p.code = 'bucha-store' AND p.address = 'м. Буча (точну адресу надає замовник)';

        UPDATE delivery.pickup_points AS p
        SET schedule = CASE WHEN length(trim(c.schedule)) BETWEEN 1 AND 200 THEN trim(c.schedule) ELSE 'Пн–Сб 09:00–17:30, Нд — вихідний' END
        FROM content.contacts AS c
        WHERE c.id = 1 AND p.code = 'bucha-store' AND p.schedule = 'Пн–Нд, 9:00–19:00 (уточнюється)';
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Preserve editable store data on rollback.
    }
}
