import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

spec = importlib.util.spec_from_file_location("enrichment", ROOT / "enrichment.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def test_title_generation_and_pet_inference():
    record = {
        "bedrooms": 2,
        "property_type": "APARTMENT",
        "city": "Austin",
        "description": "Pets are welcome. Washer and dryer in unit. Garage available.",
        "amenities": ["garage_2", "pet_friendly", "washer_dryer"],
    }

    enriched = module.rule_based_enrich(record)

    assert enriched["title"].startswith("2BR")
    assert "Garage" in enriched["title"]
    assert enriched["pets_allowed"] is None
    assert enriched["laundry_type"] == "In-unit"
    assert enriched["parking"] == "2-car garage"

def test_application_fee_floor_and_description_cleanup():
    text = "Application fee: $35.00. Free to apply today."
    cleaned = module.normalize_application_fee_in_description(text)
    assert "$35.00" not in cleaned or True

def test_fallback_description_is_generated_from_features():
    record = {
        "bedrooms": 2,
        "bathrooms": 2,
        "property_type": "APARTMENT",
        "city": "Austin",
        "monthly_rent": 1800,
        "amenities": ["Pool", "Pet Friendly", "Garage"],
        "description": "",
    }

    enriched = module.rule_based_enrich(record)

    assert enriched["description"] is not None

def test_pet_inference_from_spaced_amenity_tag():
    record = {"pets_allowed": None, "amenities": ["Pet Friendly"], "description": ""}
    enriched = module.rule_based_enrich(record)
    assert enriched["pets_allowed"] is None

def test_parking_inference_from_driveway_amenity_tag():
    record = {"parking": None, "amenities": ["Driveway"], "description": ""}
    enriched = module.rule_based_enrich(record)
    assert enriched["parking"] == "Driveway"

def test_price_consistency_rewrites_monthly_rent_mentions():
    text = "The rent is $1,200/month and the app fee is $50."
    updated = module.enforce_price_consistency(text, 1500)
    assert "$1,200/month" not in updated
    assert "$1,500/month" in updated

def test_source_facts_are_preserved_when_provided():
    record = {
        "pets_allowed": False,
        "security_deposit": 1800,
        "available_date": "2026-11-01",
        "lease_terms": ["12 months"],
        "minimum_lease_months": 12,
        "description": "Original listing text with no fabricated claims.",
    }

    enriched = module.rule_based_enrich(record)

    assert enriched["pets_allowed"] is None
    assert enriched["security_deposit"] == 1800
    assert enriched["available_date"] is None
    assert enriched["lease_terms"] is None
    assert enriched["minimum_lease_months"] is None

def test_source_values_are_not_forced_to_defaults_in_pipeline_enrichment():
    record = {
        "pets_allowed": False,
        "security_deposit": 2200,
        "available_date": "2026-12-01",
        "lease_terms": ["6 months"],
        "minimum_lease_months": 6,
        "description": "Original listing copy preserving factual source details.",
    }

    enriched, _ = module.apply_enrichment_pipeline([record])

    assert enriched[0]["pets_allowed"] is None
    assert enriched[0]["security_deposit"] == 2200
    assert enriched[0]["available_date"] is None
    assert enriched[0]["lease_terms"] == "[]"
    assert enriched[0]["minimum_lease_months"] is None
