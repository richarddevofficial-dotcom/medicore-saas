from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


DEFAULT_HOSPITAL_TIMEZONE = "Africa/Juba"

COUNTRY_TIMEZONES = {
    "Burundi": "Africa/Bujumbura",
    "Ethiopia": "Africa/Addis_Ababa",
    "Kenya": "Africa/Nairobi",
    "Rwanda": "Africa/Kigali",
    "South Sudan": "Africa/Juba",
    "Tanzania": "Africa/Dar_es_Salaam",
    "Uganda": "Africa/Kampala",
}


def timezone_for_country(country):
    normalized_country = str(country or "").strip().casefold()
    return next(
        (
            timezone_name
            for country_name, timezone_name in COUNTRY_TIMEZONES.items()
            if country_name.casefold() == normalized_country
        ),
        DEFAULT_HOSPITAL_TIMEZONE,
    )


def get_hospital_timezone(hospital):
    timezone_name = getattr(hospital, "timezone", None) or DEFAULT_HOSPITAL_TIMEZONE
    try:
        return ZoneInfo(timezone_name)
    except (ValueError, ZoneInfoNotFoundError):
        return ZoneInfo(DEFAULT_HOSPITAL_TIMEZONE)


def hospital_localtime(hospital, value):
    return value.astimezone(get_hospital_timezone(hospital))
