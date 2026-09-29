import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from source_identity import apply_identity


def test_opendoor_never_keeps_poster_identity():
    result = apply_identity({
        "source": "opendoor",
        "agent_name": "Unrelated Agent",
        "agent_image_url": "https://example.test/agent.jpg",
        "poster_landlord_id": "00000000-0000-0000-0000-000000000001",
    })
    assert result["identity_strategy"] == "NO_IDENTITY"
    assert result["agent_name"] is None
    assert result["poster_landlord_id"] is None


def test_direct_company_uses_canonical_company_profile():
    result = apply_identity({"source": "progress", "agent_name": "Wrong Person"})
    assert result["source"] == "progress_residential"
    assert result["identity_strategy"] == "COMPANY_SOURCE"
    assert result["source_profile_name"] == "Progress Residential"
    assert result["agent_name"] is None


def test_zillow_keeps_observed_agent_details():
    result = apply_identity({
        "source": "zillow",
        "agent_name": "Jordan Smith",
        "broker_name": "Example Realty",
        "agent_image_url": "https://example.test/jordan.jpg",
    })
    assert result["identity_strategy"] == "AGENT_POSTER"
    assert result["source_profile_name"] == "Jordan Smith"
    assert result["source_profile_image_url"].endswith("jordan.jpg")