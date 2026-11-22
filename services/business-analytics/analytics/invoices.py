"""Reconcile annual invoice turnover against the independent accounting register."""
from datetime import date, timedelta
from decimal import Decimal
from itertools import chain
from threading import Lock
from time import monotonic

from .register import INACTIVE, business_day, identifier, kind_of, number, sale_line
from .source import ARCHIVE_SQL, archived_rows, production


HEADERS = """
SELECT id::text, source_account AS account, day, kind, status, currency, total, number,
       source_id AS ref, details->>'type' AS raw_kind, details->>'status' AS raw_status,
       details->>'currency_iso' AS raw_currency
FROM accounting.documents
WHERE entity_type IN ('invoice','customerReturn') AND day >= %s AND day < %s
ORDER BY day,id
"""
NATIVE_LINES = """
SELECT id::text, source_account AS account, source_id AS ref, day, kind, status, currency, number,
       details->'products' AS products
FROM accounting.documents WHERE native_partner_id IS NOT NULL AND kind='out' AND day >= %s AND day < %s
"""
ARCHIVE_LINES = ARCHIVE_SQL.replace("DAY_FILTER", """r.source_day BETWEEN %s AND %s
  AND r.entity_type IN ('invoice','customerReturn')""")

# The accounting projection fills parent_ref only from parent_document.external_id. The parent
# also arrives as a plain identifier or as an object with only an id; the archive reader and the
# overview register accept those forms. Without them a receipt issued for a posted invoice would
# count as a second sale. The source can also list a receipt under its invoice without repeating
# the invoice in the receipt body: then only the import envelope, kept in the archive, names it.
PARENT_REF = """coalesce(nullif(d.parent_ref,''), CASE jsonb_typeof(d.details->'parent_document')
    WHEN 'string' THEN nullif(d.details->>'parent_document','') WHEN 'number' THEN d.details->>'parent_document'
    WHEN 'object' THEN nullif(d.details#>>'{parent_document,id}','') END,
    (SELECT nullif(a.parent_source_id,'') FROM integration.dntrade_archive_records a WHERE a.id=d.id))"""

# The register's status and currency come from the import envelope. A sales invoice is also checked
# against its own body (kind_of, currency_valid), so a receipt gets the same two checks.
BODY_ACTIVE = ("lower(btrim(coalesce(d.details->>'status',''))) NOT IN ("
               + ",".join(f"'{status}'" for status in sorted(INACTIVE)) + ")")
BODY_IN_HRYVNIA = "lower(btrim(coalesce(d.details->>'currency_iso',''))) IN ('','0','uah','980')"

# Receipts that are sales of their own. A reader that reports what it leaves out checks the body
# currency of each row itself (body_in_hryvnia); every other reader takes INDEPENDENT_RECEIPTS.
INDEPENDENT_RECEIPT_ROWS = """
WHERE d.entity_type='receipt' AND lower(d.kind) IN ('cash','6','receipt','salereceipt','salebyreceipt')
  AND lower(d.status) IN ('active','активна','активний','posted') AND lower(d.currency) IN ('uah','980')
  AND d.day >= %s AND d.day < %s AND BODY_ACTIVE
  AND NOT EXISTS (
      SELECT 1 FROM accounting.documents i
      WHERE i.source_account=d.source_account AND lower(i.source_id)=lower(PARENT_REF)
        AND i.entity_type='invoice' AND lower(i.kind) IN ('out','3','sale','salesinvoice','outgoinginvoice')
        AND lower(i.status) IN ('active','активна','активний','posted')
  )
""".replace("PARENT_REF", PARENT_REF).replace("BODY_ACTIVE", BODY_ACTIVE)
# Sum the cash register in PostgreSQL so annual charts do not need to transfer
# every receipt or wait for the assortment and forecast models to finish.
INDEPENDENT_RECEIPTS = INDEPENDENT_RECEIPT_ROWS + "  AND " + BODY_IN_HRYVNIA + "\n"
KYIV_DAY = """CASE WHEN a.source_date ~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
            THEN (a.source_date::timestamptz AT TIME ZONE 'Europe/Kyiv')::date END"""
CASH_DISCREPANCY = """(d.total IS NULL OR s.amount IS NULL OR abs(d.total) <> s.amount
        OR a.status IS DISTINCT FROM d.status OR a.source_day IS DISTINCT FROM d.day
        OR coalesce(KYIV_DAY <> d.day, false) OR s.invalid > 0)""".replace("KYIV_DAY", KYIV_DAY)
CASH_FROM = """
FROM accounting.documents d LEFT JOIN integration.dntrade_archive_records a ON a.id=d.id
LEFT JOIN LATERAL (
    SELECT sum(abs(CASE WHEN p->>'total' ~ '^[+-]?[0-9]+([.][0-9]+)?$'
                        THEN (p->>'total')::numeric END)) AS amount,
           count(*) FILTER (WHERE p->>'total' IS NULL OR p->>'total' !~ '^[+]?[0-9]+([.][0-9]+)?$'
                            OR CASE WHEN p->>'quantity' ~ '^[+]?[0-9]+([.][0-9]+)?$'
                                    THEN (p->>'quantity')::numeric <= 0 ELSE true END
                            OR coalesce(nullif(p#>>'{product,id}',''),nullif(p#>>'{product,code}',''),
                                        nullif(p#>>'{product,sku}','')) IS NULL) AS invalid
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.payload::jsonb#>'{raw,products}')='array'
                                   THEN a.payload::jsonb#>'{raw,products}' ELSE '[]'::jsonb END) p
) s ON true
""" + INDEPENDENT_RECEIPTS
CASH_MONTHS = """
SELECT extract(month FROM d.day)::int AS month, count(*) AS documents,
       sum(abs(d.total)) AS amount, sum(s.amount) AS lines,
       count(*) FILTER (WHERE CASH_DISCREPANCY) AS discrepancies""".replace("CASH_DISCREPANCY", CASH_DISCREPANCY) + CASH_FROM + " GROUP BY 1"
# The receipts behind that count, with what the count looked at, so each can be named with its reason.
CASH_ISSUES = """
SELECT d.id::text, coalesce(nullif(d.number,''), d.source_id) AS number, d.day, abs(d.total) AS header, s.amount AS lines,
       a.id IS NOT NULL AS archived, a.status IS DISTINCT FROM d.status AS status_differs, a.source_day,
       KYIV_DAY AS kyiv_day, s.invalid""".replace("KYIV_DAY", KYIV_DAY) + CASH_FROM + "  AND " + CASH_DISCREPANCY + """
ORDER BY d.day, d.id LIMIT 50"""


def currency_valid(doc):
    values = {identifier(doc.get(key)) for key in ("currency", "raw_currency")} - {""}
    return bool(values) and values <= {"uah", "980"}


def body_in_hryvnia(doc):
    """The register row of an independent receipt is in hryvnia; its body must not name another currency."""
    return identifier(doc.get("raw_currency")) in ("", "uah", "980")


_years_lock = Lock()
_years = None


def report_years(today):
    """Years that have sales. Finding them checks the body of every receipt, so the answer is kept for 15 minutes."""
    global _years
    with _years_lock:
        if _years is None or _years[0] != today or monotonic() >= _years[1]:
            _years = today, monotonic() + 900, read_years(today)
        return _years[2]


def read_years(today):
    bounds = date(1900, 1, 1), today + timedelta(days=1)
    with production() as conn:
        headers = conn.execute("""
            SELECT DISTINCT extract(year FROM day)::int AS year, source_account AS account, kind, status, currency,
                   details->>'type' AS raw_kind, details->>'status' AS raw_status, details->>'currency_iso' AS raw_currency
            FROM accounting.documents WHERE entity_type IN ('invoice','customerReturn') AND day >= %s AND day < %s
            """, bounds)
        years = {r["year"] for r in headers if kind_of(r) in ("sale", "return") and currency_valid(r)}
        years.update(r["year"] for r in conn.execute(
            "SELECT DISTINCT extract(year FROM d.day)::int AS year FROM accounting.documents d " + INDEPENDENT_RECEIPTS, bounds))
        web = conn.execute("""
            SELECT DISTINCT extract(year FROM created_at AT TIME ZONE 'Europe/Kyiv')::int AS year FROM ordering.orders
            WHERE created_at >= (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
              AND created_at < (%s::date::timestamp AT TIME ZONE 'Europe/Kyiv')
              AND status IN ('Paid','Shipped','ReadyForPickup','Completed')""", bounds)
        markets = years | {r["year"] for r in web}
    return dict(invoices=sorted(years, reverse=True), markets=sorted(markets, reverse=True))


def compare(year, headers, documents, through=None):
    expected, actual, candidates = {}, {}, {}
    for doc in headers:
        if through and doc["day"] > through:
            continue
        kind = kind_of(doc)
        if kind not in ("sale", "return", "invalid"):
            continue
        total = number(doc.get("total"))
        ok = kind != "invalid" and currency_valid(doc) and total is not None
        expected[doc["id"]] = (doc["day"], kind, abs(total) if ok else None, doc.get("number") or doc["ref"])
    for doc in documents:
        day = business_day(doc)
        kind = kind_of(doc)
        if not day or day.year != year or (through and day > through) or kind not in ("sale", "return", "invalid"):
            continue
        lines = doc.get("products")
        amounts, invalid = [], 0
        for line in lines if isinstance(lines, list) else []:
            parsed = sale_line(line, kind == "return")
            if parsed:
                amounts.append(parsed[-1])
            else:
                invalid += 1
        amount = sum(amounts) if amounts and currency_valid(doc) and kind != "invalid" else None
        entry = (day, kind, amount, doc.get("number") or doc["ref"], invalid)
        key = doc["account"], identifier(doc.get("external")) or identifier(doc["ref"]), kind
        priority = (amount is None, invalid, doc["id"])
        if key not in candidates or priority < candidates[key][0]:
            candidates[key] = priority, doc["id"], entry
    for _, doc_id, entry in candidates.values():
        actual[doc_id] = entry

    def bucket():
        return dict(sales=Decimal(0), returns=Decimal(0), lineSales=Decimal(0), lineReturns=Decimal(0),
                    documents=0, lineDocuments=0, knownHeaders=0, knownLines=0, discrepancies=0)

    months = [bucket() for _ in range(12)]
    issues = []
    for doc_id in sorted(expected.keys() | actual.keys()):
        header, line = expected.get(doc_id), actual.get(doc_id)
        for entry, count, plus, minus in ((header, "documents", "sales", "returns"),
                                          (line, "lineDocuments", "lineSales", "lineReturns")):
            if entry:
                month = months[entry[0].month - 1]
                month[count] += 1
                if entry[2] is not None:
                    month["knownHeaders" if count == "documents" else "knownLines"] += 1
                    month[minus if entry[1] == "return" else plus] += entry[2]
        if header and line and header[:3] == line[:3] and line[2] is not None and not line[4]:
            continue
        entry = header or line
        months[entry[0].month - 1]["discrepancies"] += 1
        if len(issues) < 50:
            reasons = []
            if not header or not line:
                reasons.append("Відсутній запис у реєстрі" if not header else "Відсутні товарні рядки джерела")
            else:
                if header[0] != line[0]:
                    reasons.append(f"Дата в реєстрі {header[0]}, дата джерела за Києвом {line[0]}")
                if header[1] != line[1]:
                    reasons.append("Тип документа відрізняється")
                if header[2] is None or line[2] is None:
                    reasons.append("Недостатньо даних для звірки суми")
                elif header[2] != line[2]:
                    reasons.append("Суми відрізняються")
                if line[4]:
                    reasons.append("Є некоректні товарні рядки")
            issues.append(dict(id=doc_id, number=entry[3], day=str(entry[0]),
                               header=header[2] if header else None, lines=line[2] if line else None,
                               inRegister=bool(header), reason=". ".join(reasons)))
    total = {k: sum(m[k] for m in months) for k in months[0]}
    for m in [*months, total]:
        m["net"] = m["sales"] - m["returns"] if m["knownHeaders"] else None
        m["lineNet"] = m["lineSales"] - m["lineReturns"] if m["knownLines"] else None
        if not m["knownHeaders"]:
            m["sales"] = m["returns"] = None
        m["difference"] = m["lineNet"] - m["net"] if None not in (m["lineNet"], m["net"]) else None
    return dict(year=year, total=total, months=months, issues=issues)


def add_cash(report, cash):
    by_month = {r["month"]: r for r in cash}
    for index, period in enumerate(report["months"], 1):
        row = by_month.get(index, {})
        period.update(cash=row.get("amount"), cashLines=row.get("lines"),
                      cashDocuments=row.get("documents", 0), cashDiscrepancies=row.get("discrepancies", 0))
    total = report["total"]
    for key in ("cash", "cashLines", "cashDocuments", "cashDiscrepancies"):
        values = [m[key] for m in report["months"] if m[key] is not None]
        total[key] = sum(values) if values else None
    for period in [*report["months"], total]:
        for field, parts in (("documentNet", ("net", "cash")), ("documentLineNet", ("lineNet", "cashLines"))):
            values = [period[key] for key in parts if period[key] is not None]
            period[field] = sum(values) if values else None
    return report


def cash_issue(row):
    """Name a receipt that the monthly count treats as a discrepancy, in the shape of an invoice issue."""
    reasons = []
    if not row["archived"]:
        reasons.append("Відсутній запис джерела в архіві")
    else:
        if row["lines"] is None:
            reasons.append("Відсутні товарні рядки джерела")
        if row["status_differs"]:
            reasons.append("Статус у реєстрі відрізняється від статусу в архіві")
        if row["source_day"] != row["day"]:
            reasons.append(f"Дата в реєстрі {row['day']}, дата в архіві {row['source_day']}")
        elif row["kyiv_day"] and row["kyiv_day"] != row["day"]:
            reasons.append(f"Дата в реєстрі {row['day']}, дата джерела за Києвом {row['kyiv_day']}")
    if row["header"] is None:
        reasons.append("Недостатньо даних для звірки суми")
    elif row["lines"] is not None and row["header"] != row["lines"]:
        reasons.append("Суми відрізняються")
    if row["invalid"]:
        reasons.append("Є некоректні товарні рядки")
    return dict(id=row["id"], number=row["number"], day=str(row["day"]), header=row["header"], lines=row["lines"],
                inRegister=True, receipt=True, reason=". ".join(reasons))


def read_year(year, through=None):
    last = min(through or date(year, 12, 31), date(year, 12, 31))
    start, end = date(year, 1, 1), last + timedelta(days=1)
    with production() as conn:
        headers = conn.execute(HEADERS, (start, end)).fetchall()
        native = conn.execute(NATIVE_LINES, (start, end)).fetchall()
        archive = archived_rows(conn, ARCHIVE_LINES, (start - timedelta(days=1), end))
        report = compare(year, headers, chain(archive, native), last)
        add_cash(report, conn.execute(CASH_MONTHS, (start, end)))
        # Listing repeats the pass over the archived bodies, so it runs only when the monthly count found something.
        found = report["total"]["cashDiscrepancies"]
        report["cashIssues"] = [cash_issue(r) for r in conn.execute(CASH_ISSUES, (start, end))] if found else []
    return dict(report, through=str(last), months=report["months"][:last.month])
