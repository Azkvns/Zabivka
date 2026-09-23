import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.domain import (
    CatalogRow,
    CsvRowError,
    TobaccoPick,
    TooNarrow,
    parse_catalog_csv,
    select_mix,
)


def _pick(id_: int, strength: str, *flavors: str) -> TobaccoPick:
    return TobaccoPick(id=id_, strength=strength, flavors=frozenset(flavors))


def test_select_mix_raises_too_narrow_when_pool_smaller_than_count():
    pool = [_pick(1, "лёгкая", "мята"), _pick(2, "средняя", "ягоды")]
    with pytest.raises(TooNarrow):
        select_mix(pool, count=3, mode="random", rng=random.Random(0))


def test_select_mix_random_returns_three_distinct_from_pool():
    pool = [
        _pick(1, "лёгкая", "мята"),
        _pick(2, "средняя", "ягоды"),
        _pick(3, "крепкая", "цитрус"),
        _pick(4, "лёгкая", "фрукты"),
        _pick(5, "средняя", "десерт"),
    ]
    result = select_mix(pool, count=3, mode="random", rng=random.Random(42))
    assert len(result) == 3
    assert len({p.id for p in result}) == 3
    assert set(result).issubset(set(pool))


def test_select_mix_softer_and_stronger_stay_in_pool_and_respect_seed():
    pool = [
        _pick(1, "лёгкая", "мята"),
        _pick(2, "средняя", "ягоды"),
        _pick(3, "крепкая", "цитрус"),
        _pick(4, "лёгкая", "фрукты"),
        _pick(5, "средняя", "десерт"),
        _pick(6, "крепкая", "специи"),
    ]
    softer_a = select_mix(pool, count=3, mode="softer", rng=random.Random(7))
    softer_b = select_mix(pool, count=3, mode="softer", rng=random.Random(7))
    stronger_a = select_mix(pool, count=3, mode="stronger", rng=random.Random(7))
    stronger_b = select_mix(pool, count=3, mode="stronger", rng=random.Random(7))

    assert softer_a == softer_b
    assert stronger_a == stronger_b
    assert set(softer_a).issubset(set(pool))
    assert set(stronger_a).issubset(set(pool))
    assert len({p.id for p in softer_a}) == 3
    assert len({p.id for p in stronger_a}) == 3


def test_select_mix_different_flavors_rejects_overlapping_mint():
    """{мята} и {мята, холодок} пересекаются — пары размера 2 из них нет."""
    pool = [
        _pick(1, "лёгкая", "мята"),
        _pick(2, "средняя", "мята", "холодок"),
    ]
    with pytest.raises(TooNarrow):
        select_mix(pool, count=2, mode="different_flavors", rng=random.Random(0))


def test_select_mix_different_flavors_picks_disjoint_set():
    pool = [
        _pick(1, "лёгкая", "мята"),
        _pick(2, "средняя", "мята", "холодок"),
        _pick(3, "крепкая", "ягоды"),
        _pick(4, "лёгкая", "цитрус"),
    ]
    result = select_mix(pool, count=2, mode="different_flavors", rng=random.Random(1))
    assert len(result) == 2
    a, b = result
    assert a.flavors.isdisjoint(b.flavors)
    # пересечение мяты не должно попасть в один микс
    ids = {a.id, b.id}
    assert ids != {1, 2}


def test_parse_catalog_csv_bad_strength_on_line_3_rejects_whole_file():
    text = (
        "бренд,название,крепость,вкусы\n"
        "Darkside,Cosmo,лёгкая,ягоды\n"
        "MustHave,Berry,неизвестная,фрукты\n"
    )
    with pytest.raises(CsvRowError) as exc_info:
        parse_catalog_csv(text)
    assert exc_info.value.line == 3
    # Whole file rejected: no partial list returned
    with pytest.raises(CsvRowError):
        parse_catalog_csv(text)


def test_parse_catalog_csv_duplicate_brand_name_points_to_second_line():
    text = (
        "бренд,название,крепость,вкусы\n"
        "Darkside,Cosmo,лёгкая,ягоды\n"
        "Other,Name,средняя,мята\n"
        "Darkside,Cosmo,крепкая,цитрус\n"
    )
    with pytest.raises(CsvRowError) as exc_info:
        parse_catalog_csv(text)
    assert exc_info.value.line == 4


def test_parse_catalog_csv_valid_rows():
    text = (
        "бренд,название,крепость,вкусы\n"
        "Darkside,Cosmo,лёгкая,\"ягоды,мята\"\n"
        "MustHave,Pineapple,средняя,фрукты\n"
    )
    rows = parse_catalog_csv(text)
    assert rows == [
        CatalogRow(
            brand="Darkside",
            name="Cosmo",
            strength="лёгкая",
            flavors=("ягоды", "мята"),
        ),
        CatalogRow(
            brand="MustHave",
            name="Pineapple",
            strength="средняя",
            flavors=("фрукты",),
        ),
    ]
