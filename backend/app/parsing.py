import datetime as dt

from dateutil import parser as dateutil_parser


def parse_date(value) -> dt.date | None:
    if value in (None, ""):
        return None
    if isinstance(value, dt.date):
        return value
    try:
        return dateutil_parser.parse(str(value), dayfirst=False, yearfirst=True).date()
    except (ValueError, OverflowError):
        try:
            return dateutil_parser.parse(str(value), dayfirst=True).date()
        except (ValueError, OverflowError):
            return None


def to_float(value) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        cleaned = str(value).replace(",", "").replace("Rs.", "").replace("Rs", "").strip()
        return float(cleaned)
    except ValueError:
        return None


def normalize_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()
