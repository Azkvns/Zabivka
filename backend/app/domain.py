"""Pure domain: mix selection and catalog CSV parsing."""

from __future__ import annotations

import csv
import io
import random
from dataclasses import dataclass
from itertools import combinations

STRENGTHS = frozenset({"лёгкая", "средняя", "крепкая"})
FLAVORS = frozenset(
    {
        "ягоды",
        "цитрус",
        "фрукты",
        "десерт",
        "мята",
        "специи",
        "напитки",
        "классика",
        "холодок",
    }
)

_SOFTER_WEIGHTS = {"лёгкая": 4, "средняя": 2, "крепкая": 1}
_STRONGER_WEIGHTS = {"лёгкая": 1, "средняя": 2, "крепкая": 4}


class TooNarrow(Exception):
    pass


class CsvRowError(Exception):
    def __init__(self, line: int, reason: str) -> None:
        self.line = line
        self.reason = reason
        super().__init__(f"line {line}: {reason}")


@dataclass(frozen=True)
class TobaccoPick:
    id: int
    strength: str
    flavors: frozenset[str]


@dataclass(frozen=True)
class CatalogRow:
    brand: str
    name: str
    strength: str
    flavors: tuple[str, ...]


def select_mix(
    pool: list[TobaccoPick],
    count: int,
    mode: str,
    rng: random.Random,
) -> list[TobaccoPick]:
    if len(pool) < count:
        raise TooNarrow()

    if mode == "random":
        return rng.sample(pool, count)

    if mode in ("softer", "stronger"):
        weights_map = _SOFTER_WEIGHTS if mode == "softer" else _STRONGER_WEIGHTS
        remaining = list(pool)
        chosen: list[TobaccoPick] = []
        for _ in range(count):
            weights = [weights_map[t.strength] for t in remaining]
            pick = rng.choices(remaining, weights=weights, k=1)[0]
            chosen.append(pick)
            remaining.remove(pick)
        return chosen

    if mode == "different_flavors":
        order = list(pool)
        rng.shuffle(order)
        for combo in combinations(order, count):
            if all(
                a.flavors.isdisjoint(b.flavors)
                for a, b in combinations(combo, 2)
            ):
                return list(combo)
        raise TooNarrow()

    raise ValueError(f"unknown mode: {mode}")


def parse_catalog_csv(text: str) -> list[CatalogRow]:
    reader = csv.reader(io.StringIO(text))
    try:
        header = next(reader)
    except StopIteration as exc:
        raise CsvRowError(1, "missing header") from exc

    expected = ["бренд", "название", "крепость", "вкусы"]
    if header != expected:
        raise CsvRowError(1, "invalid header")

    rows: list[CatalogRow] = []
    seen_pairs: set[tuple[str, str]] = set()

    for line_no, cells in enumerate(reader, start=2):
        if len(cells) != 4:
            raise CsvRowError(line_no, "expected 4 columns")

        brand, name, strength, flavors_cell = (c.strip() for c in cells)

        if not brand:
            raise CsvRowError(line_no, "empty brand")
        if not name:
            raise CsvRowError(line_no, "empty name")
        if strength not in STRENGTHS:
            raise CsvRowError(line_no, "unknown strength")

        if not flavors_cell.strip():
            raise CsvRowError(line_no, "empty flavors")

        flavor_parts = [p.strip() for p in flavors_cell.split(";")]
        if any(not p for p in flavor_parts):
            raise CsvRowError(line_no, "empty flavor")
        for flavor in flavor_parts:
            if flavor not in FLAVORS:
                raise CsvRowError(line_no, "unknown flavor")
        if len(flavor_parts) != len(set(flavor_parts)):
            raise CsvRowError(line_no, "repeated flavor")

        pair = (brand, name)
        if pair in seen_pairs:
            raise CsvRowError(line_no, "repeated brand+name")
        seen_pairs.add(pair)

        rows.append(
            CatalogRow(
                brand=brand,
                name=name,
                strength=strength,
                flavors=tuple(flavor_parts),
            )
        )

    return rows
