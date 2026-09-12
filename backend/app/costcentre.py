"""Maps the free-text location on an invoice (bill-to / deliver-to) to one of
Thambili's seven cost centres (six restaurants + the central kitchen).

Codes match what's already used in existing_records.csv (CC-CKN, CC-C03, ...).
"""

# (cost_centre_code, [keywords to look for in the lowercased location text])
_LOCATIONS: list[tuple[str, list[str]]] = [
    ("CC-CKN", ["central kitchen", "sedawatte", "wellampitiya"]),
    ("CC-C03", ["colombo 03", "colombo03", "duplication road"]),
    ("CC-C07", ["colombo 07", "colombo07", "gregory's road", "gregorys road"]),
    ("CC-BAT", ["battaramulla", "pannipitiya road"]),
    ("CC-RAJ", ["rajagiriya", "jayawardenepura"]),
    ("CC-MLV", ["mount lavinia", "hotel road"]),
    ("CC-NUG", ["nugegoda", "high level road"]),
]


def resolve_cost_centre(*texts: str | None) -> str:
    """Returns a cost centre code, or "" if none of the location hints matched."""
    haystack = " ".join(t for t in texts if t).lower()
    if not haystack:
        return ""
    for code, keywords in _LOCATIONS:
        if any(keyword in haystack for keyword in keywords):
            return code
    return ""


ALL_COST_CENTRES = [code for code, _ in _LOCATIONS]
