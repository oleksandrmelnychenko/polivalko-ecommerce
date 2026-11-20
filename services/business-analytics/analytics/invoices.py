"""Reconcile annual invoice turnover against the independent accounting register."""
from datetime import date, timedelta
from decimal import Decimal
from itertools import chain

from .register import business_day, identifier, kind_of, number, sale_line
from .source import ARCHIVE_SQL, production


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


def currency_valid(doc):
    values = {identifier(doc.get(key)) for key in ("currency", "raw_currency")} - {""}
    return bool(values) and values <= {"uah", "980"}


def compare(year, headers, documents):
    expected, actual, candidates = {}, {}, {}
    for doc in headers:
        kind = kind_of(doc)
        if kind not in ("sale", "return", "invalid"):
            continue
        total = number(doc.get("total"))
        ok = kind != "invalid" and currency_valid(doc) and total is not None
        expected[doc["id"]] = (doc["day"], kind, abs(total) if ok else None, doc.get("number") or doc["ref"])
    for doc in documents:
        day = business_day(doc)
        kind = kind_of(doc)
        if not day or day.year != year or kind not in ("sale", "return", "invalid"):
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
            issues.append(dict(id=doc_id, number=entry[3], day=str(entry[0]),
                               header=header[2] if header else None, lines=line[2] if line else None,
                               inRegister=bool(header)))
    total = {k: sum(m[k] for m in months) for k in months[0]}
    for m in [*months, total]:
        m["net"] = m["sales"] - m["returns"] if m["knownHeaders"] else None
        m["lineNet"] = m["lineSales"] - m["lineReturns"] if m["knownLines"] else None
        if not m["knownHeaders"]:
            m["sales"] = m["returns"] = None
        m["difference"] = m["lineNet"] - m["net"] if None not in (m["lineNet"], m["net"]) else None
    return dict(year=year, total=total, months=months, issues=issues)


def read_year(year):
    start, end = date(year, 1, 1), date(year + 1, 1, 1)
    with production() as conn, conn.cursor("annual_invoice_lines") as archive:
        headers = conn.execute(HEADERS, (start, end)).fetchall()
        native = conn.execute(NATIVE_LINES, (start, end)).fetchall()
        archive.itersize = 100
        archive.execute(ARCHIVE_LINES, (start - timedelta(days=1), end))
        return compare(year, headers, chain(archive, native))
