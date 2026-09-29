"""Source identity policy shared by the Python ingestion orchestrator.

The Edge Function builder is the authoritative write path, but the Python
orchestrator stages records directly for legacy jobs. Keeping this small policy
in sync prevents those jobs from attaching an individual to a company source
or to Opendoor.
"""

from __future__ import annotations

from typing import Any, Dict

ALIASES = {
    "progress": "progress_residential",
    "progress-residential": "progress_residential",
    "invitation": "invitation_homes",
    "invitation-homes": "invitation_homes",
    "invitation homes": "invitation_homes",
    "main-street-renewal": "main_street_renewal",
    "main street renewal": "main_street_renewal",
    "mainstreetrenewal": "main_street_renewal",
    "cjrealestate": "cj_real_estate",
    "cj": "cj_real_estate",
    "cj properties": "cj_real_estate",
    "cj realty": "cj_real_estate",
}

COMPANIES = {
    "progress_residential": "Progress Residential",
    "invitation_homes": "Invitation Homes",
    "main_street_renewal": "Main Street Renewal",
    "cj_real_estate": "CJ Real Estate",
}


def normalize_source(value: Any) -> str:
    raw = str(value or "zillow").strip().lower()
    return ALIASES.get(raw, raw)


def classify_identity(record: Dict[str, Any]) -> Dict[str, Any]:
    source = normalize_source(record.get("source"))
    agent_name = str(record.get("agent_name") or "").strip() or None
    broker_name = str(record.get("broker_name") or "").strip() or None
    agent_image = str(record.get("agent_image_url") or "").strip() or None
    agent_profile = str(record.get("agent_profile_url") or "").strip() or None
    supplied_name = str(record.get("source_profile_name") or "").strip() or None
    supplied_image = str(record.get("source_profile_image_url") or "").strip() or None
    supplied_url = str(record.get("source_profile_url") or "").strip() or None

    if source == "opendoor":
        return {
            "source": source,
            "source_type": "SPECIAL_CASE",
            "identity_strategy": "NO_IDENTITY",
            "identity_status": "unavailable",
            "source_profile_type": None,
            "source_profile_name": None,
            "source_profile_image_url": None,
            "source_profile_url": None,
            "agent_name": None,
            "agent_image_url": None,
            "agent_profile_url": None,
            "poster_landlord_id": None,
        }

    if source in COMPANIES:
        name = supplied_name or broker_name or COMPANIES[source]
        return {
            "source": source,
            "source_type": "DIRECT_PROPERTY_COMPANY",
            "identity_strategy": "COMPANY_SOURCE",
            "identity_status": "confirmed",
            "source_profile_type": "company",
            "source_profile_name": name,
            "source_profile_image_url": supplied_image,
            "source_profile_url": supplied_url,
            "agent_name": None,
            "agent_image_url": None,
            "agent_profile_url": None,
            "poster_landlord_id": None,
        }

    if source in {"zillow", "realtor"} or agent_name or agent_profile:
        return {
            "source": source,
            "source_type": "AGENT_PLATFORM" if source in {"zillow", "realtor"} else "UNKNOWN",
            "identity_strategy": "AGENT_POSTER",
            "identity_status": "confirmed" if agent_name or agent_profile else "unavailable",
            "source_profile_type": "agent",
            "source_profile_name": agent_name,
            "source_profile_image_url": agent_image,
            "source_profile_url": agent_profile,
            "agent_name": agent_name,
            "agent_image_url": agent_image,
            "agent_profile_url": agent_profile,
            "poster_landlord_id": record.get("poster_landlord_id"),
        }

    return {
        "source": source,
        "source_type": "AGGREGATOR" if source in {"apartments", "redfin"} else "UNKNOWN",
        "identity_strategy": "UNKNOWN_REVIEW",
        "identity_status": "review",
        "source_profile_type": None,
        "source_profile_name": None,
        "source_profile_image_url": None,
        "source_profile_url": None,
        "agent_name": agent_name,
        "agent_image_url": agent_image,
        "agent_profile_url": agent_profile,
        "poster_landlord_id": None,
    }


def apply_identity(record: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy normalized for direct pipeline staging."""
    normalized = dict(record)
    normalized.update(classify_identity(normalized))
    return normalized