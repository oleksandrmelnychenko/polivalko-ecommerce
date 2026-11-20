"""Compare a DNTrade source archive with the batches prepared for the console."""
import argparse
import hashlib
import json
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path


def lines(path):
    with path.open(encoding="utf-8-sig") as stream:
        for line in stream:
            if line.strip():
                yield json.loads(line, parse_float=Decimal)


def verify_file(path, entry):
    with path.open("rb") as stream:
        checksum = hashlib.file_digest(stream, "sha256").hexdigest()
    return checksum == entry["sha256"] and path.stat().st_size == entry["bytes"]


def identity(record):
    # Exported invoices may be classified as receipts or returns for ingestion.
    return (record["stream"].split(":")[0], record["sourceId"])


def fingerprint(record):
    payload = json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"),
                         default=lambda decimal: {"$decimal": str(decimal)})
    return hashlib.sha256(payload.encode()).digest()


def compare(source, uploads):
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8-sig"))
    manifests = [(directory, json.loads((directory / "ingest-manifest.json").read_text(encoding="utf-8-sig"))) for directory in uploads]
    accounts = {manifest["sourceAccount"] for _, manifest in manifests}
    if accounts != {manifest["sourceAccount"]}:
        raise ValueError("Source accounts differ")
    expected_counts = Counter()
    files = []
    for directory, batch_manifest in manifests:
        expected_counts.update(batch_manifest["types"])
        files.extend((directory, batch) for batch in batch_manifest["batches"])
    archive = manifest["files"]["archive"]
    file_errors = []
    for group in manifest["files"].values():
        for entry in group if isinstance(group, list) else [group]:
            if not verify_file(source / entry["file"], entry):
                file_errors.append(entry["file"])
    expected = {}
    duplicates = []
    for record in lines(source / archive["file"]):
        key = identity(record)
        if key in expected:
            duplicates.append(key)
        if record["entityType"] == "invoice":
            record["entityType"] = {"cash": "receipt", "back": "customerReturn"}.get(record["documentType"], "invoice")
        expected[key] = fingerprint(record)
    missing = set(expected)
    changes = []
    extra = []
    raw_amount_mismatches = []
    counts = Counter()
    totals = defaultdict(Decimal)
    seen = set()
    for upload, batch in files:
        path = upload / batch["file"]
        if not verify_file(path, batch):
            file_errors.append(path.name)
        for record in lines(path):
            key = identity(record)
            if key in seen:
                duplicates.append(key)
            seen.add(key)
            missing.discard(key)
            if key not in expected:
                extra.append(key)
            elif fingerprint(record) != expected[key]:
                changes.append(key)
            kind = record["entityType"]
            counts[kind] += 1
            if record.get("total") is not None:
                amount = Decimal(str(record["total"]))
                totals[(kind, record.get("currency") or "unspecified")] += amount
                field = "total_sum" if kind in ("cashOrder", "bankPayment") else "total_price"
                raw_amount = record["raw"].get(field)
                if raw_amount is None or amount != Decimal(str(raw_amount)):
                    raw_amount_mismatches.append(key)
    return dict(source=source.name, sourceAccount=manifest["sourceAccount"], asOf=manifest["asOf"],
                sourceKeys=len(expected), batchKeys=len(seen), batches=len(files),
                missing=sorted(missing), unexpected=extra, changedFields=changes,
                duplicateKeys=duplicates, fileErrors=file_errors, rawAmountDifferences=raw_amount_mismatches,
                typeCountsMatch=counts == expected_counts, sourceManifestCountMatches=archive["rows"] == len(expected),
                providerCompletenessVerified=manifest["providerCompletenessVerified"],
                counts=dict(counts), totalsByTypeAndCurrency=[
                    dict(type=k[0], currency=k[1], total=str(v)) for k, v in sorted(totals.items())])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("upload", type=Path, nargs="+")
    args = parser.parse_args()
    result = compare(args.source, args.upload)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(int(any(result[k] for k in ("missing", "unexpected", "changedFields", "duplicateKeys",
                                                 "fileErrors", "rawAmountDifferences"))
                         or not result["typeCountsMatch"] or not result["sourceManifestCountMatches"]))
