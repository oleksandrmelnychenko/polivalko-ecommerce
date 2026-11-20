"""Rebuild the two public map assets from the pinned inputs documented in README."""
import argparse
import csv
import gzip
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "web/apps/console/src/features/product-analytics/components"
DIRECTORY = Path(__file__).parent / "analytics/data/settlements.csv.gz"


def project(lon, lat):
    return round((lon - 22) * 55, 2), round((53 - lat) * 84, 2)


def simplify(points, tolerance=0.32):
    """Douglas-Peucker in map units. Preserve holes and small islands."""
    if len(points) < 3:
        return points
    (x, y), (end_x, end_y) = points[0], points[-1]
    dx, dy = end_x - x, end_y - y
    length = dx * dx + dy * dy
    best, split = 0, 0
    for i, (px, py) in enumerate(points[1:-1], 1):
        t = max(0, min(1, ((px-x)*dx + (py-y)*dy) / length)) if length else 0
        distance = (px - x - t*dx)**2 + (py - y - t*dy)**2
        if distance > best:
            best, split = distance, i
    if best <= tolerance**2:
        return [points[0], points[-1]]
    return simplify(points[:split+1], tolerance)[:-1] + simplify(points[split:], tolerance)


def boundaries(filename):
    shapes = {}
    for feature in json.loads(filename.read_text(encoding="utf-8"))["features"]:
        code = feature["properties"]["shapeISO"].replace("-", "")
        geom = feature["geometry"]
        polygons = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
        paths, all_points = [], []
        for polygon in polygons:
            for ring in polygon:
                points = [project(*p) for p in ring]
                all_points.extend(points)
                line = simplify(points)
                if len(line) < 4:
                    line = points
                paths.append("M" + "L".join(f"{x:g},{y:g}" for x,y in line[:-1]) + "Z")
        xs, ys = zip(*all_points)
        pad = max(max(xs)-min(xs), max(ys)-min(ys)) * .085
        bounds = [min(xs)-pad, min(ys)-pad, max(xs)-min(xs)+2*pad, max(ys)-min(ys)+2*pad]
        shapes[code] = dict(path="".join(paths), bounds=[round(n, 2) for n in bounds])
    if len(shapes) != 27:
        raise ValueError("Expected 27 administrative units")
    (ASSETS / "ukraineRegions.json").write_text(json.dumps(shapes, sort_keys=True, separators=(",", ":")) + "\n")
    return set(shapes)


def settlements(filename, expected):
    import io

    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    regions = set()
    with filename.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            if row["level"] != "4" and row["category"] != "K":
                continue
            # KATOTTG prefixes differ from ISO 3166-2 for these five units.
            prefix = row["code"][2:4]
            iso = {"01":"43", "44":"09", "73":"77", "80":"30", "85":"40"}.get(prefix, prefix)
            regions.add("UA" + iso)
            xy = ("", "")
            if row["lat"] and row["lon"] and row["match"] in {"code", "name", "parent"}:
                xy = project(float(row["lon"]), float(row["lat"]))
            writer.writerow([iso, row["code"], row["category"], row["name"], *xy])
    if regions != expected:
        raise ValueError("Settlement and boundary region codes disagree")
    DIRECTORY.parent.mkdir(exist_ok=True)
    DIRECTORY.write_bytes(gzip.compress(output.getvalue().encode(), compresslevel=9, mtime=0))


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("katottg_csv", type=Path)
    args.add_argument("boundaries_geojson", type=Path)
    inputs = args.parse_args()
    settlements(inputs.katottg_csv, boundaries(inputs.boundaries_geojson))
