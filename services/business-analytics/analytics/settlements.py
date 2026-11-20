"""Match stated buyer localities to public KATOTTG settlement centres offline."""
import csv
import gzip
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple


class Place(NamedTuple):
    region: str
    code: str
    kind: str
    name: str
    x: float | None
    y: float | None


# Extract locality fragments in PostgreSQL. House numbers, street addresses
# and delivery contact fields are never returned to the report.
def address_fields(column):
    name = r"[а-яА-ЯіІїЇєЄґҐ’''ʼ -]{2,60}"
    # Street separators and a leading postal code occur in legacy text addresses.
    # Only the locality capture group is projected out of PostgreSQL.
    street = r"(?:[Вв]ул\.|[Вв]улиця|[Пп]ров\.|[Пп]ровулок|[Пп]росп\.|[Пп]роспект|[Бб]ул\.)"
    end = rf"(?:[,;]|[[:space:]]+{street}|$)"
    city = rf"""coalesce(
      substring({column} COLLATE "C" from '(?:^|[,;[:space:]])((?:[Мм]\.|[Сс]\.|[Мм]істо |[Сс]ело |[Сс]елище |смт\.? )[[:space:]]*{name}){end}'),
      substring({column} COLLATE "C" from '(?:^|[,;])[[:space:]]*([А-ЯІЇЄҐ]{name})[,;][[:space:]]*{street}'),
      substring({column} COLLATE "C" from '^[[:space:]]*(?:[0-9]{{5}}[,;[:space:]]+)?([А-ЯІЇЄҐ][а-яА-ЯіІїЇєЄґҐ’''ʼ -]{{1,48}}){end}'))"""
    region = rf"""substring({column} COLLATE "C" from '([а-яА-ЯіІїЇєЄґҐ-]+)[[:space:]]+[Оо]бл(?:асть|\.)?(?:[,;[:space:]]|$)')"""
    return city, region


def normalize(value):
    return " ".join((value or "").casefold().replace("’", "'").replace("ʼ", "'").split())


@lru_cache(maxsize=1)
def directory():
    by_name, by_code = defaultdict(list), {}
    with gzip.open(Path(__file__).parent / "data/settlements.csv.gz", "rt", encoding="utf8") as data:
        for region, code, kind, name, x, y in csv.reader(data):
            place = Place(region, code, "M" if kind == "K" else kind, name,
                          float(x) if x else None, float(y) if y else None)
            by_name[normalize(name)].append(place)
            by_code[code] = place
    return by_name, by_code


PREFIX = re.compile(r"^(місто |м\.\s*|село |с\.\s*|селище міського типу |селище |смт\.?\s+|с-ще\s+)")


@lru_cache(maxsize=4096)
def resolve(region, raw_city, allow_infer):
    value = normalize(raw_city)
    if not value or len(value) > 140:
        return region, None
    names, codes = directory()
    kind = None
    if match := PREFIX.match(value):
        prefix = match.group().strip()
        kind = "M" if prefix in ("м.", "місто") else "C" if prefix in ("с.", "село") else "X"
        value = value[match.end():].strip()
    elif value in ("україна", "украина", "ukraine"):
        return region, None
    # Carrier names can include a parenthetical district. A name collision
    # inside the region still needs a type or a register code.
    value = re.sub(r"\s+\([^()]+\)$", "", value)
    candidates = [codes[value.upper()]] if value.upper() in codes else names.get(value, ())
    if kind:
        candidates = [p for p in candidates if p.kind == kind]
    if region:
        # Carrier directories commonly put the two special cities under their
        # surrounding regions. A settlement with the same name elsewhere keeps its region.
        if region == "32" and value == "київ" and kind != "C":
            region = "30"
        elif region == "43" and value == "севастополь" and kind != "C":
            region = "40"
        candidates = [p for p in candidates if p.region == region]
    elif not allow_infer:
        return None, None
    if len(candidates) == 1:
        place = candidates[0]
        return place.region, place if place.x is not None and place.y is not None else None
    if candidates and len({p.region for p in candidates}) == 1:
        region = candidates[0].region
    return region, None
