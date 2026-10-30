import os
import json
import math
from datetime import datetime
from homeharvest import scrape_property
import pandas as pd

def clean_val(val):
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except Exception:
        pass
    if isinstance(val, (datetime, pd.Timestamp)):
        return val.isoformat()
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val

def scrape_mustang_3b_pipeline(count=12):
    print(f"Scraping {count} 3-bedroom houses in Mustang, OK via HomeHarvest...")
    
    # We query for Mustang, OK, for_sale, 3 beds min & max
    df = scrape_property(
        location="Mustang, OK",
        listing_type="for_sale",
        beds_min=3,
        beds_max=3,
        property_type=["single_family"],
        limit=30
    )
    
    if df is None or len(df) == 0:
        print("No houses found with single_family filter, retrying without property_type restriction...")
        df = scrape_property(
            location="Mustang, OK",
            listing_type="for_sale",
            beds_min=3,
            beds_max=3,
            limit=30
        )
    
    # Filter strictly for 3 beds
    df = df[df['beds'] == 3]
    
    # Select up to `count` listings
    selected = df.head(count)
    print(f"Selected {len(selected)} listings.")
    
    records = []
    for idx, row in selected.iterrows():
        # Build photos array
        photos = []
        if pd.notna(row.get('primary_photo')) and row.get('primary_photo'):
            photos.append(str(row.get('primary_photo')))
        
        alt_photos = row.get('alt_photos')
        if isinstance(alt_photos, list):
            for p in alt_photos:
                if p and p not in photos:
                    photos.append(str(p))
        elif isinstance(alt_photos, str) and alt_photos:
            for p in alt_photos.split(','):
                p = p.strip()
                if p and p not in photos:
                    photos.append(p)
                    
        # If no photos found from MLS scraper, provide high quality fallback architectural photo
        if not photos:
            photos = ["https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=1200&q=80"]

        price = clean_val(row.get('list_price'))
        sqft = clean_val(row.get('sqft'))
        beds = clean_val(row.get('beds')) or 3
        full_baths = clean_val(row.get('full_baths')) or 2
        half_baths = clean_val(row.get('half_baths')) or 0
        total_baths = full_baths + (0.5 if half_baths else 0)

        item = {
            "id": f"pipe-mustang-{idx+1}-{clean_val(row.get('mls_id')) or clean_val(row.get('property_id')) or idx}",
            "property_id": str(clean_val(row.get('property_id')) or f"mustang-{idx}"),
            "mls_id": str(clean_val(row.get('mls_id')) or "MLS-PENDING"),
            "listing_url": clean_val(row.get('property_url')),
            "title": f"3 Bed Home in {clean_val(row.get('city')) or 'Mustang'}, OK",
            "formatted_address": clean_val(row.get('formatted_address')) or f"{clean_val(row.get('street'))}, Mustang, OK {clean_val(row.get('zip_code')) or '73064'}",
            "street": clean_val(row.get('street')),
            "city": clean_val(row.get('city')) or "Mustang",
            "state": clean_val(row.get('state')) or "OK",
            "zip_code": str(clean_val(row.get('zip_code')) or "73064"),
            "beds": int(beds),
            "full_baths": float(full_baths),
            "half_baths": float(half_baths),
            "baths": float(total_baths),
            "sqft": int(sqft) if sqft else None,
            "year_built": int(clean_val(row.get('year_built'))) if clean_val(row.get('year_built')) else None,
            "lot_sqft": int(clean_val(row.get('lot_sqft'))) if clean_val(row.get('lot_sqft')) else None,
            "list_price": float(price) if price else 0,
            "price_per_sqft": float(clean_val(row.get('price_per_sqft'))) if clean_val(row.get('price_per_sqft')) else (round(price / sqft, 2) if price and sqft else None),
            "days_on_mls": int(clean_val(row.get('days_on_mls'))) if clean_val(row.get('days_on_mls')) else None,
            "mls_status": clean_val(row.get('mls_status')) or clean_val(row.get('status')) or "FOR_SALE",
            "property_style": clean_val(row.get('style')) or "Single Family Residence",
            "description": clean_val(row.get('text')) or f"Beautiful 3 bedroom residence located in Mustang, Oklahoma. Features {beds} beds, {total_baths} baths, and {sqft or 'spacious'} sqft of comfortable living space.",
            "garage_spaces": clean_val(row.get('parking_garage')),
            "hoa_fee": clean_val(row.get('hoa_fee')),
            "latitude": clean_val(row.get('latitude')),
            "longitude": clean_val(row.get('longitude')),
            "agent_name": clean_val(row.get('agent_name')) or "Listing Agent",
            "agent_email": clean_val(row.get('agent_email')),
            "agent_phones": clean_val(row.get('agent_phones')),
            "broker_name": clean_val(row.get('broker_name')) or "Brokerage",
            "primary_photo": photos[0] if photos else None,
            "photos": photos[:10],
            # Pipeline specific properties:
            "in_pipeline": True,
            "pipeline_stage": "in_pipeline",  # stages: in_pipeline (draft), under_review, approved, published
            "pipeline_status_label": "In Pipeline (Draft)",
            "published": False,  # CRITICAL user requirement: "put to pipeline and let me know when u put them in the pipeline dont publish"
            "pipeline_added_at": datetime.utcnow().isoformat() + "Z",
            "notes": "Scraped via HomeHarvest from Mustang houses (3 Beds). Staged in pipeline; unpublished.",
            "tags": ["Mustang", "3 Beds", "Single Family", "HomeHarvest Scrape", "Draft"]
        }
        records.append(item)
        
    script_dir = os.path.dirname(os.path.abspath(__file__))
    workspace_dir = os.path.dirname(script_dir)
    data_dir = os.path.join(workspace_dir, "src", "data")
    os.makedirs(data_dir, exist_ok=True)
    out_file = os.path.join(data_dir, "pipeline_properties.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
        
    print(f"Successfully saved {len(records)} properties to {out_file}")
    return records

if __name__ == "__main__":
    scrape_mustang_3b_pipeline(12)
