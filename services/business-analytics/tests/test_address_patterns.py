"""The locality pattern runs inside PostgreSQL; this pins the rule that was checked there."""
from unittest import TestCase

from analytics.settlements import address_fields


class AddressPatternTests(TestCase):
    def test_bare_name_before_a_house_number_is_not_a_settlement(self):
        # On PostgreSQL 18: "Садова, 12", "Лісова, 5а" and "Польова, 1/2" give no settlement, while
        # "Буча", "Буча, 08292", "08292, Буча, вул. Шевченка, 3" and "м. Ірпінь, 12" keep theirs.
        city, _ = address_fields("address")
        bare = city.rsplit("substring(", 1)[1]
        self.assertIn("[,;](?![[:space:]]*[0-9]{1,4}(?:[^0-9]|$))", bare)
        self.assertNotIn("(?!", city.rsplit("substring(", 1)[0])
