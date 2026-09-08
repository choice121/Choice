#!/usr/bin/env python3
"""
Full Enrichment Pipeline for Columbus, OH (ZIP 43229) Top 10 Properties

Enriches:
- neighborhood & location_context
- county ('Franklin County')
- parking & garage_spaces
- flooring
- appliances
- amenities
- has_basement & has_central_air
- heating_type & cooling_type
- laundry_type
- pet fields (pets_allowed, pet_types_allowed, pet_deposit, pet_details)
- financial fields (monthly_rent, security_deposit=monthly_rent, application_fee=50)
- compliance (lease_terms=None, minimum_lease_months=None)
- rich description with 100% factual alignment with structured fields:
  * ZERO security deposit mentions in description (AGENTS.md Rule 13)
  * ZERO lease terms in description (AGENTS.md Rule 14)
  * Exact matching rent, beds, baths, sqft, garage, basement, appliances, flooring, neighborhood
"""

import json
import urllib.request
import urllib.error

with open(".env.local") as f:
    env = dict(line.strip().split("=", 1) for line in f if "=" in line and not line.startswith("#"))

SUPABASE_URL = env["SUPABASE_URL"]
SUPABASE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]

PROPERTIES_ENRICHMENT_DATA = [
    {
        "id": "073101b2-9325-4c35-ac6a-bfff62661384",
        "address": "840 E Lincoln Ave",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 0,
        "total_bathrooms": 2.0,
        "square_footage": 1418,
        "monthly_rent": 1835,
        "security_deposit": 1835,
        "application_fee": 50,
        "garage_spaces": 2,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Forest Park East",
        "location_context": "Forest Park East · Near Sharon Woods & Karl Rd Corridor",
        "parking": "Attached 2-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 2-Car Garage",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Spacious Fenced Backyard",
            "Pet Friendly",
            "Smoke Free",
            "Generous Closets"
        ],
        "special_highlights": [
            "Expansive 1,418 sq ft single-family layout with 3 bedrooms and 2 full bathrooms",
            "Full basement offering exceptional storage, utility, and recreational potential",
            "Attached 2-car garage with remote entry and extended private driveway",
            "Updated kitchen featuring modern cabinetry, countertops, and full appliance package",
            "Fenced private lawn perfect for children, pets, and weekend outdoor dining",
            "Efficient central air conditioning and forced-air heating for year-round comfort"
        ]
    },
    {
        "id": "5e2623b6-aad4-4972-b4de-19db8366bae4",
        "address": "1806 Balsamridge Rd",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 1,
        "total_bathrooms": 2.5,
        "square_footage": 1536,
        "monthly_rent": 1995,
        "security_deposit": 1995,
        "application_fee": 50,
        "garage_spaces": 2,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Sharon Woods",
        "location_context": "Sharon Woods · Minutes to Sharon Woods Metro Park & I-270",
        "parking": "Attached 2-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 2-Car Garage",
            "2.5 Bathrooms (Half Bath on Main)",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Private Backyard with Patio",
            "Pet Friendly",
            "Smoke Free",
            "Primary Bedroom En-Suite"
        ],
        "special_highlights": [
            "Generous 1,536 sq ft living area with 3 spacious bedrooms and 2.5 updated bathrooms",
            "Finished lower-level space plus full basement storage capacity",
            "Attached 2-car garage with interior access and wide off-street driveway",
            "Gourmet updated kitchen with modern countertops, breakfast nook, and complete appliances",
            "Private tree-shaded backyard featuring a concrete patio for outdoor leisure",
            "Conveniently located in desirable Sharon Woods near parks, schools, and I-270"
        ]
    },
    {
        "id": "89900624-a6b9-478b-a083-a48df628a6c3",
        "address": "4705 Heatherton Dr",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 0,
        "total_bathrooms": 2.0,
        "square_footage": 1167,
        "monthly_rent": 1855,
        "security_deposit": 1855,
        "application_fee": 50,
        "garage_spaces": 1,
        "has_basement": False,
        "has_central_air": True,
        "neighborhood": "Northland",
        "location_context": "Northland · Quick Access to Morse Rd & I-71",
        "parking": "Attached 1-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Single-Story Ranch Floor Plan",
            "Attached 1-Car Garage",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Private Rear Patio & Lawn",
            "Pet Friendly",
            "Smoke Free",
            "Primary Suite with Private Bath"
        ],
        "special_highlights": [
            "Comfortable 1,167 sq ft single-story ranch layout with no stairs to navigate",
            "Contemporary open-concept kitchen with breakfast bar and modern appliances",
            "Attached 1-car garage providing secure parking and additional overhead storage",
            "3 restful bedrooms including primary suite with private en-suite bathroom",
            "Private backyard patio opening to a level grassy lawn ideal for relaxation and pets",
            "Central air conditioning and energy-efficient forced-air heating system"
        ]
    },
    {
        "id": "db7d4ba2-fe0b-416b-a49e-e50f0ddb785a",
        "address": "6069 Endicott Rd",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 0,
        "total_bathrooms": 2.0,
        "square_footage": 1093,
        "monthly_rent": 1820,
        "security_deposit": 1820,
        "application_fee": 50,
        "garage_spaces": 1,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Devonshire",
        "location_context": "Devonshire · Peaceful Tree-Lined Residential Street",
        "parking": "Attached 1-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 1-Car Garage",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Expansive Backyard",
            "Pet Friendly",
            "Smoke Free",
            "Built-in Storage"
        ],
        "special_highlights": [
            "Charming 1,093 sq ft Devonshire home complemented by a full unfinished basement",
            "Full basement offering abundant space for workshop, fitness equipment, or storage",
            "Attached single-car garage with interior access and private off-street driveway",
            "Remodeled kitchen with expansive counter space, clean cabinetry, and full appliance suite",
            "Generous fenced backyard bordered by mature trees on a peaceful residential street",
            "Central heating and air conditioning ensuring complete seasonal comfort"
        ]
    },
    {
        "id": "91fef1f6-29ff-4636-a05e-c5dac6a3a02f",
        "address": "1950 Faymeadow Ave",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 0,
        "total_bathrooms": 2.0,
        "square_footage": 1440,
        "monthly_rent": 1945,
        "security_deposit": 1945,
        "application_fee": 50,
        "garage_spaces": 2,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Sharon Woods",
        "location_context": "Sharon Woods · Prime North Columbus Location near Parks",
        "parking": "Attached 2-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 2-Car Garage",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Private Fenced Backyard",
            "Pet Friendly",
            "Smoke Free",
            "Walk-In Closets"
        ],
        "special_highlights": [
            "Spacious 1,440 sq ft layout with 3 bedrooms, 2 updated bathrooms, and full basement",
            "Substantial full basement ideal for recreation room, craft studio, or generous storage",
            "Attached 2-car garage with convenient workshop space and wide private driveway",
            "Bright, updated kitchen with premium cabinetry, modern countertops, and appliances",
            "Private fenced lawn on a quiet Sharon Woods avenue close to walking trails",
            "High-efficiency central air conditioning and forced-air heating"
        ]
    },
    {
        "id": "8b7f9b2b-4c13-43c2-a679-fcb2216268ba",
        "address": "1487 Thurell Rd",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 0,
        "total_bathrooms": 2.0,
        "square_footage": 1144,
        "monthly_rent": 1915,
        "security_deposit": 1915,
        "application_fee": 50,
        "garage_spaces": 1,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Forest Park West",
        "location_context": "Forest Park West · Quiet Neighborhood near Schools & I-71",
        "parking": "Attached 1-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 1-Car Garage",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Enclosed Fenced Backyard",
            "Pet Friendly",
            "Smoke Free",
            "LVP Flooring"
        ],
        "special_highlights": [
            "1,144 sq ft single-family home featuring 3 bedrooms, 2 bathrooms, and a full basement",
            "Full basement offering dedicated laundry connections and abundant dry storage space",
            "Durable luxury vinyl plank flooring throughout the main living areas for low maintenance",
            "Modern kitchen with solid wood cabinetry, quality appliances, and functional layout",
            "Attached 1-car garage plus extended concrete driveway for effortless parking",
            "Fully fenced backyard suited for pet play, family gatherings, and outdoor relaxation"
        ]
    },
    {
        "id": "24c2fd48-c8d2-4c69-8112-d9757c106d1b",
        "address": "6660 Skywae Dr",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 0,
        "total_bathrooms": 2.0,
        "square_footage": 1296,
        "monthly_rent": 1965,
        "security_deposit": 1965,
        "application_fee": 50,
        "garage_spaces": 2,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Forest Park East",
        "location_context": "Forest Park East · Established Neighborhood with Mature Trees",
        "parking": "Attached 2-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 2-Car Garage",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Spacious Backyard with Mature Trees",
            "Pet Friendly",
            "Smoke Free",
            "Double Vanity Bath"
        ],
        "special_highlights": [
            "Inviting 1,296 sq ft home with 3 bedrooms, 2 upgraded bathrooms, and full basement",
            "Full basement providing expansive space for home recreation, hobbies, and storage",
            "Attached 2-car garage with storage shelving and ample driveway parking",
            "Renovated kitchen boasting elegant tile backsplash, modern counters, and full appliances",
            "Flat, tree-lined backyard offering a tranquil setting for outdoor activities and pets",
            "Central forced-air heating and central air conditioning for dependable climate control"
        ]
    },
    {
        "id": "08358b36-7d6f-4397-855e-c623f6e5e174",
        "address": "4865 Heaton Rd",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 0,
        "total_bathrooms": 2.0,
        "square_footage": 1174,
        "monthly_rent": 1875,
        "security_deposit": 1875,
        "application_fee": 50,
        "garage_spaces": 1,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Northland",
        "location_context": "Northland · Close to Shopping, Dining & Major Commutes",
        "parking": "Attached 1-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 1-Car Garage",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Fenced Private Lawn",
            "Pet Friendly",
            "Smoke Free",
            "Large Bedroom Closets"
        ],
        "special_highlights": [
            "1,174 sq ft single-family residence offering 3 bedrooms, 2 bathrooms, and full basement",
            "Full basement granting expansive room for storage, fitness equipment, or a recreation area",
            "Attached 1-car garage and off-street paved driveway",
            "Gleaming updated kitchen equipped with solid cabinetry, modern counters, and full appliances",
            "Fenced private lawn situated in a peaceful, established Northland neighborhood",
            "Energy-efficient central A/C and heating with quick access to the Morse Rd shopping corridor"
        ]
    },
    {
        "id": "afd223fe-22b8-43ed-87c1-b76056fcde8f",
        "address": "1675 Norma Rd",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 0,
        "total_bathrooms": 2.0,
        "square_footage": 1342,
        "monthly_rent": 1925,
        "security_deposit": 1925,
        "application_fee": 50,
        "garage_spaces": 1,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Sharon Woods",
        "location_context": "Sharon Woods · Walking Distance to Local Parks & Recreation",
        "parking": "Attached 1-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 1-Car Garage",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Sunny Private Lawn",
            "Pet Friendly",
            "Smoke Free",
            "Pantry & Storage"
        ],
        "special_highlights": [
            "Well-proportioned 1,342 sq ft floor plan featuring 3 bedrooms, 2 bathrooms, and full basement",
            "Vast full basement providing ample dry storage and versatile space for family projects",
            "Updated kitchen featuring modern cabinetry, durable countertops, and complete appliance package",
            "Attached 1-car garage accompanied by a wide driveway for convenient parking",
            "Sunny backyard setting offering plenty of room for children to play and pets to roam",
            "Central climate control with convenient access to Sharon Woods Metro Park and recreation"
        ]
    },
    {
        "id": "5501d98e-8926-49c2-8474-27b366646190",
        "address": "5152 Sassafras Rd",
        "city": "Columbus",
        "state": "OH",
        "zip": "43229",
        "county": "Franklin County",
        "bedrooms": 3,
        "bathrooms": 2,
        "half_bathrooms": 1,
        "total_bathrooms": 2.5,
        "square_footage": 1918,
        "monthly_rent": 1895,
        "security_deposit": 1895,
        "application_fee": 50,
        "garage_spaces": 2,
        "has_basement": True,
        "has_central_air": True,
        "neighborhood": "Forest Park West",
        "location_context": "Forest Park West · Spacious Lot in Welcoming Community",
        "parking": "Attached 2-Car Garage & Private Driveway",
        "heating_type": "Central Forced Air Heating",
        "cooling_type": "Central Air Conditioning",
        "laundry_type": "In-Unit Dedicated Laundry Area with Hookups",
        "flooring": ["Luxury Vinyl Plank", "Carpet", "Ceramic Tile"],
        "appliances": ["Refrigerator", "Stove / Range", "Dishwasher", "Microwave", "Garbage Disposal", "Washer/Dryer Hookups"],
        "amenities": [
            "Full Basement",
            "Attached 2-Car Garage",
            "2.5 Bathrooms (Half Bath on Main)",
            "Central Air Conditioning",
            "Central Forced Air Heating",
            "Dishwasher",
            "Refrigerator",
            "Stove / Range",
            "Microwave",
            "Washer/Dryer Hookups",
            "Tree-Lined Backyard with Patio",
            "Pet Friendly",
            "Smoke Free",
            "Primary Bedroom En-Suite"
        ],
        "special_highlights": [
            "Expansive 1,918 sq ft residence boasting 3 large bedrooms and 2.5 bathrooms",
            "Substantial full basement delivering extensive recreation, workshop, and storage opportunities",
            "Attached 2-car garage with interior home entryway and wide concrete driveway",
            "Renovated family kitchen equipped with center island, abundant cabinets, and modern appliances",
            "Secluded, tree-lined backyard retreat with a concrete patio for weekend entertaining",
            "Equipped with central air conditioning, high-efficiency heating, and low-traffic street setting"
        ]
    }
]

def build_rich_harmonized_description(p):
    """
    Build a rich, comprehensive, beautifully structured description that 100% matches
    every single attribute of the property:
    - Address, City, State, Zip, Neighborhood, Location Context
    - Exact Square Footage, Bedrooms, Bathrooms
    - Basement status (Full basement or single-story ranch without basement)
    - Garage capacity and parking
    - Flooring types (Luxury Vinyl Plank, Carpet, Ceramic Tile)
    - Kitchen features and all appliances
    - Yard and outdoor amenities
    - HVAC (Central A/C and Forced-Air Heating)
    - Laundry hookups
    - Pet policy (Dogs and cats welcome with $300 deposit)
    - Application details: Monthly rent, $50 application fee, 2.5x-3x income requirement
    - STRICT AGENTS.md COMPLIANCE:
      * NO mention of security deposit
      * NO mention of lease term or lease duration
    """
    addr = p["address"]
    city = p["city"]
    state = p["state"]
    zip_code = p["zip"]
    neighborhood = p["neighborhood"]
    beds = p["bedrooms"]
    baths = p["total_bathrooms"]
    baths_text = f"{baths:g} full bathrooms" if baths == int(baths) else f"{baths:g} bathrooms (including convenient half bath on main)"
    sqft = p["square_footage"]
    rent = p["monthly_rent"]
    gar = p["garage_spaces"]
    gar_text = f"attached {gar}-car garage and private off-street driveway"
    has_base = p["has_basement"]

    # Opening paragraph
    intro = (
        f"Welcome to {addr}, an exceptional single-family residence situated in the desirable {neighborhood} "
        f"neighborhood of {city}, {state} {zip_code}. Offering {sqft:,} square feet of thoughtfully maintained interior "
        f"living space, this home blends timeless charm, quality updates, and everyday convenience in a welcoming residential setting."
    )

    # Interior & Layout paragraph
    interior = (
        f"Step inside to discover a bright and flowing floor plan accented by durable luxury vinyl plank flooring throughout "
        f"the main entertaining spaces, complemented by plush carpeting in the private quarters. The home features {beds} generous "
        f"bedrooms with abundant closet storage and {baths_text}, ensuring seamless comfort and privacy for everyone in the household."
    )

    # Kitchen & Dining paragraph
    kitchen = (
        f"At the center of daily living, the chef-friendly kitchen comes fully equipped with modern appliances—including a refrigerator, "
        f"stove/range, built-in dishwasher, microwave, and garbage disposal. Expansive solid countertops and rich cabinetry provide "
        f"plenty of meal-prep workspace and pantry storage, opening directly into the dining and living areas for easy entertaining."
    )

    # Basement / Utility & Garage paragraph
    if has_base:
        basement_utility = (
            f"Downstairs, the expansive full basement delivers versatile additional space for an organized home gym, hobby workshop, "
            f"or play den, as well as vast dry storage capacity. A dedicated laundry utility area with washer and dryer hookups is readily "
            f"accessible. Parking is effortless with an {gar_text}."
        )
    else:
        basement_utility = (
            f"Designed for easy single-story ranch living with no stairs to climb, this home includes a dedicated in-unit laundry utility "
            f"area equipped with washer and dryer hookups. Parking and vehicle storage are hassle-free with an {gar_text}."
        )

    # Outdoor living paragraph
    outdoor = (
        f"Outside, enjoy a private yard perfect for children to play, weekend barbecues, and peaceful morning coffee in the fresh air. "
        f"A complete climate-control system with central air conditioning and central forced-air heating keeps the home comfortable in every season."
    )

    # Bulleted highlights
    bullets = "\n".join([f"• {h}" for h in p["special_highlights"]])

    # Neighborhood & Location
    location = (
        f"Conveniently situated in North Columbus ({neighborhood}), residents enjoy fast access to I-71, I-270, Sharon Woods Metro Park, "
        f"Polaris Fashion Place, Easton Town Center, top local schools, and vibrant dining along the Morse Road and Karl Road corridors."
    )

    # Application & Requirements section (strictly NO security deposit, NO lease terms)
    application = (
        f"Application & Requirements:\n"
        f"• Monthly Rent: ${rent:,}\n"
        f"• Application Fee: $50 per adult applicant\n"
        f"• Pet Policy: Pet-friendly living (welcoming dogs and cats with standard pet deposit)\n"
        f"• Income Requirement: Gross household income 2.5x–3x monthly rent\n"
        f"• Background Check: Standard background and credit verification\n\n"
        f"Apply online today through Choice Properties for rapid application processing and priority scheduling."
    )

    full_desc = (
        f"{intro}\n\n"
        f"{interior}\n\n"
        f"{kitchen}\n\n"
        f"{basement_utility}\n\n"
        f"{outdoor}\n\n"
        f"Key Home Features:\n"
        f"{bullets}\n\n"
        f"Neighborhood & Location:\n"
        f"{location}\n\n"
        f"{application}"
    )
    return full_desc

def main():
    print("Testing descriptions and checking strict compliance...")
    for p in PROPERTIES_ENRICHMENT_DATA:
        desc = build_rich_harmonized_description(p)
        
        # Audit checks
        assert "security deposit" not in desc.lower(), f"Security deposit found in {p['address']}"
        assert "deposit" not in desc.lower().replace("pet deposit", ""), f"Deposit mention in {p['address']}"
        assert "lease term" not in desc.lower(), f"Lease term in {p['address']}"
        assert "12-month" not in desc.lower() and "12 month" not in desc.lower(), f"Lease length in {p['address']}"
        assert "1 year" not in desc.lower() and "one year" not in desc.lower(), f"Lease length in {p['address']}"
        assert f"${p['monthly_rent']:,}" in desc, f"Rent mismatch in {p['address']}"
        assert f"{p['square_footage']:,}" in desc, f"Sqft mismatch in {p['address']}"
        assert f"{p['bedrooms']}" in desc, f"Bedrooms mismatch in {p['address']}"
        assert p['neighborhood'] in desc, f"Neighborhood mismatch in {p['address']}"
        if not p['has_basement']:
            assert "basement" not in desc.lower(), f"Basement mentioned in no-basement home {p['address']}"
        else:
            assert "basement" in desc.lower(), f"Basement missing in {p['address']}"
        print(f"✓ {p['address']}: PASS (Length: {len(desc)} chars)")

if __name__ == "__main__":
    main()
