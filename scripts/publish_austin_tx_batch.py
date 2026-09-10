#!/usr/bin/env python3
"""
Choice Properties — Austin, TX 15-Property Second-Chance Batch Publisher
========================================================================
Publishes 15 of the best available 2-bedroom rental properties in Austin, TX:
- Exactly 2 bedrooms
- Final monthly rent between $1,400 and $1,500/mo
- Security deposit equal to 1x rent in DB, strictly 0 mentions in descriptions (Rule 13)
- Strictly 0 mentions of lease terms / lease duration (Rule 14)
- Application fee: $50
- Pet friendly: True (Dogs and Cats welcome)
- Safe, quiet, desirable residential areas in Austin
- Flexible / second-chance friendly screening consideration (no guarantees)
- Minimum 6 genuine property photographs per listing uploaded to ImageKit and verified HTTP 200
- Posts to Supabase `properties` and `property_photos` tables
- Outputs the required Post-Publishing Mandatory AI Response Format
"""

import os
import sys
import json
import uuid
import time
import base64
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

# Load environment variables from .env.local
env_path = os.path.join(os.path.dirname(__file__), '..', '.env.local')
env = {}
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                env[k] = v

SUPABASE_URL = env.get('SUPABASE_URL', 'https://tlfmwetmhthpyrytrcfo.supabase.co')
SUPABASE_KEY = env.get('SUPABASE_SERVICE_ROLE_KEY', '')
IMAGEKIT_KEY = env.get('IMAGEKIT_PRIVATE_KEY', '')
IMAGEKIT_ENDPOINT = env.get('IMAGEKIT_URL_ENDPOINT', 'https://ik.imagekit.io/21rg7lvzo')
LANDLORD_ID = '0e5eeed2-316e-4739-a694-e5058888208e'

SB_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

IK_AUTH = base64.b64encode(f'{IMAGEKIT_KEY}:'.encode()).decode()

def upload_to_imagekit(source_url, folder, file_name):
    """Uploads remote image URL to ImageKit and returns (ik_url, file_id) after HTTP 200 check."""
    data = urllib.parse.urlencode({
        'file': source_url,
        'fileName': file_name,
        'folder': folder
    }).encode()
    
    req = urllib.request.Request(
        'https://upload.imagekit.io/api/v1/files/upload',
        data=data,
        headers={
            'Authorization': f'Basic {IK_AUTH}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    )
    
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                res = json.loads(resp.read().decode())
                ik_url = res.get('url')
                file_id = res.get('fileId')
                
                # Check HTTP HEAD 200
                v_req = urllib.request.Request(ik_url, method='HEAD')
                with urllib.request.urlopen(v_req, timeout=10) as v_resp:
                    if v_resp.status == 200:
                        return ik_url, file_id
        except Exception as e:
            time.sleep(1.5 * (attempt + 1))
    return None, None

# Load photo sources mapping
sources_path = os.path.join(os.path.dirname(__file__), 'austin_photo_sources.json')
with open(sources_path) as f:
    PHOTO_SOURCES = json.load(f)

# 15 Curated Austin 2-Bedroom Rental Properties
AUSTIN_PROPERTIES = [
    {
        "slug": "emerald",
        "title": "Inviting 2-Bedroom Home in South Austin | Cherry Creek",
        "address": "6305 Emerald Forest Dr Unit B",
        "city": "Austin",
        "state": "TX",
        "zip": "78745",
        "county": "Travis",
        "neighborhood": "Cherry Creek / South Austin",
        "lat": 30.2078,
        "lng": -97.8094,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 985,
        "monthly_rent": 1475,
        "security_deposit": 1475,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Private Fenced Yard", "Dedicated Off-Street Parking", "Spacious Closets", "Wood-Style Plank Flooring", "Patio"],
        "appliances": ["Refrigerator", "Electric Range / Oven", "Dishwasher", "Washer/Dryer Connections"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Private Driveway",
        "description": (
            "Welcome to 6305 Emerald Forest Drive Unit B, a comfortable and well-maintained 2-bedroom, 2-bathroom "
            "residence located in the highly desirable Cherry Creek neighborhood of South Austin. This quiet, tree-lined "
            "community provides the perfect balance of suburban tranquility with immediate access to Central Austin, "
            "South Congress, and Sunset Valley shopping centers.\n\n"
            "Inside, the home features an open-concept living and dining area accentuated by durable wood-style plank "
            "flooring and large windows that fill the space with natural light. The kitchen is equipped with solid wood "
            "cabinetry, clean appliances including range and dishwasher, and generous counter space for daily meal preparation. "
            "Both bedrooms are generously sized with ample closet storage, and the primary bedroom includes a private full bath. "
            "Step outside to enjoy a private fenced backyard, ideal for peaceful outdoor relaxation and pet exercise.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 985 Sq. Ft. of well-planned living area\n"
            "• Efficient central heating and cooling system\n"
            "• Modern kitchen with full appliance suite\n"
            "• In-unit washer and dryer connections\n"
            "• Private fenced backyard and shaded patio\n"
            "• Dedicated off-street parking\n"
            "• Pet-friendly living (Dogs and Cats welcome)\n\n"
            "Screening & Application Details:\n"
            "Applications are evaluated on an individualized basis. Applicants with non-traditional credit histories or past "
            "rental challenges are reviewed holistically with verifiable household income and positive recent payment history."
        )
    },
    {
        "slug": "matador",
        "title": "Spacious 2-Bedroom Townhome in Southeast Austin | Montopolis",
        "address": "3006 Matador Dr Unit A",
        "city": "Austin",
        "state": "TX",
        "zip": "78741",
        "county": "Travis",
        "neighborhood": "Montopolis / East Riverside",
        "lat": 30.2291,
        "lng": -97.7015,
        "property_type": "townhouse",
        "bedrooms": 2,
        "bathrooms": 1,
        "square_footage": 1440,
        "monthly_rent": 1495,
        "security_deposit": 1495,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Spacious Floor Plan", "Private Backyard", "Covered Carport Parking", "Ceiling Fans", "Updated Bath"],
        "appliances": ["Refrigerator", "Range / Oven", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Covered Carport",
        "description": (
            "Located at 3006 Matador Drive Unit A, this expansive 2-bedroom, 1-bathroom townhome offers an impressive "
            "1,440 square feet of versatile interior space in a quiet Southeast Austin enclave. Conveniently situated just "
            "minutes from Lady Bird Lake, Roy G. Guerrero Colorado River Park, and downtown Austin, this home delivers unmatched "
            "space and accessibility.\n\n"
            "The ground level features a large living room that opens naturally to the kitchen and dining space. The kitchen boasts "
            "extensive cabinetry, a double sink, and a complete appliance package. Upstairs, two oversized bedrooms feature vaulted "
            "ceilings, multiple closets, and large windows. An updated bathroom with modern vanity and tile surround serves both rooms. "
            "Outdoor features include a private fenced yard and covered parking.\n\n"
            "Property Features:\n"
            "• 2 Spacious Bedrooms, 1 Full Bathroom\n"
            "• 1,440 Sq. Ft. of generous multi-level living\n"
            "• Central heating and air conditioning\n"
            "• Clean kitchen with extensive prep surfaces\n"
            "• In-unit laundry hookups\n"
            "• Covered carport and off-street parking\n"
            "• Private outdoor yard\n"
            "• Welcoming pet policy for dogs and cats\n\n"
            "Screening & Application Details:\n"
            "Our leasing team utilizes an individualized application review process. Steady employment, verifiable monthly earnings, "
            "and satisfactory recent tenancy are prioritized for prospective residents."
        )
    },
    {
        "slug": "singletree",
        "title": "Modern 2-Bedroom Duplex in North Austin Tech Corridor",
        "address": "2401 Singletree Ave Unit B",
        "city": "Austin",
        "state": "TX",
        "zip": "78727",
        "county": "Travis",
        "neighborhood": "Scofield Ridge / North Austin",
        "lat": 30.4192,
        "lng": -97.7028,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 1100,
        "monthly_rent": 1475,
        "security_deposit": 1475,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Fireplace", "Private Fenced Yard", "Attached Garage", "Hard Surface Flooring", "High Ceilings"],
        "appliances": ["Refrigerator", "Stove / Oven", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Attached Garage",
        "description": (
            "Experience contemporary North Austin living at 2401 Singletree Avenue Unit B. Situated in the peaceful "
            "Scofield Ridge community near Parmer Lane, this 2-bedroom, 2-bathroom duplex home offers prime proximity to "
            "major tech employers, The Domain, and Scofield Farms Neighborhood Park.\n\n"
            "The home features an open floor plan centered around a handsome decorative fireplace, cathedral ceilings, and low-maintenance "
            "hard surface flooring throughout all main living areas. The kitchen provides ample cabinet storage, a breakfast bar, "
            "and clean appliances. Both bedrooms are split for optimal privacy, each with its own dedicated full bathroom. "
            "The enclosed private backyard and attached garage add everyday convenience and security.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 1,100 Sq. Ft. of bright living space\n"
            "• Cathedral ceilings and wood-style flooring\n"
            "• Functional kitchen with breakfast bar seating\n"
            "• Central air conditioning and heating\n"
            "• Attached garage with driveway parking\n"
            "• Fully fenced private backyard with patio\n"
            "• Pet-friendly property\n\n"
            "Screening & Application Details:\n"
            "Each prospective applicant receives a fair, individualized review. Stable income and verifiable rental history "
            "are evaluated holistically to accommodate applicants rebuilding their credit profiles."
        )
    },
    {
        "slug": "hearthside",
        "title": "Charming 2-Bedroom Residence in Crestview / North Central Austin",
        "address": "1911 Hearthside Dr Unit A",
        "city": "Austin",
        "state": "TX",
        "zip": "78757",
        "county": "Travis",
        "neighborhood": "Crestview / North Central Austin",
        "lat": 30.3541,
        "lng": -97.7214,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 1,
        "square_footage": 900,
        "monthly_rent": 1400,
        "security_deposit": 1400,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Wood-Look Flooring", "Private Backyard", "Driveway Parking", "Ceiling Fans", "Large Closets"],
        "appliances": ["Refrigerator", "Electric Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Private Driveway",
        "description": (
            "Nestled in the quiet, established neighborhood of North Central Austin near Crestview and Wooten, "
            "1911 Hearthside Drive Unit A is a refreshed 2-bedroom, 1-bathroom home offering comfortable, easy living. "
            "This central location provides rapid access to Anderson Lane eateries, Burnet Road boutiques, and the Crestview Station.\n\n"
            "Inside, durable wood-look flooring spans the bright living room and dining alcove. The kitchen features white cabinetry, "
            "solid countertops, and essential appliances ready for move-in. Two peaceful bedrooms offer generous closet space and "
            "easy access to the full hall bathroom with tub/shower combination. A shaded, private backyard provides a tranquil outdoor "
            "retreat.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 1 Full Bathroom\n"
            "• 900 Sq. Ft. of efficient interior living\n"
            "• Central heating and cooling system\n"
            "• Modern wood-style flooring (carpet-free main areas)\n"
            "• Private fenced backyard with mature trees\n"
            "• Off-street driveway parking\n"
            "• In-unit laundry hookups\n"
            "• Fully pet-friendly for approved dogs and cats\n\n"
            "Screening & Application Details:\n"
            "We offer a supportive, case-by-case screening approach. Applicants with past housing difficulties or credit blemishes "
            "are considered based on verifiable employment, sufficient monthly income, and recent positive history."
        )
    },
    {
        "slug": "springmail",
        "title": "Inviting 2-Bedroom Home in Northwest Austin | Anderson Mill",
        "address": "8806 Springmail Cir",
        "city": "Austin",
        "state": "TX",
        "zip": "78729",
        "county": "Travis",
        "neighborhood": "Anderson Mill / Northwest Austin",
        "lat": 30.4501,
        "lng": -97.7681,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 1150,
        "monthly_rent": 1450,
        "security_deposit": 1450,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Cul-de-Sac Setting", "Private Fenced Yard", "Attached Garage", "Fireplace", "Ceiling Fans"],
        "appliances": ["Refrigerator", "Gas Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Attached Garage",
        "description": (
            "Situated on a quiet residential cul-de-sac in Northwest Austin, 8806 Springmail Circle delivers peace, "
            "privacy, and exceptional comfort. The Anderson Mill area is renowned for its excellent parks, greenbelts, and "
            "convenient access to US-183, Lakeline Mall, and major employment corridors.\n\n"
            "The home features a welcoming living room with high ceilings, decorative stone fireplace, and ceramic tile flooring. "
            "The open kitchen includes ample cabinetry, gas cooking, and a breakfast area overlooking the patio. Two roomy bedrooms "
            "offer plush carpeting and sizable closets, accompanied by two full bathrooms. The private, shaded backyard is fully "
            "fenced and ideal for family gatherings and pets.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 1,150 Sq. Ft. of comfortable living space\n"
            "• Quiet cul-de-sac location with minimal traffic\n"
            "• Central heating and air conditioning\n"
            "• Well-appointed kitchen with gas stove and dishwasher\n"
            "• Private attached garage and concrete driveway\n"
            "• Enclosed private backyard with shade trees\n"
            "• Pet friendly (dogs & cats welcome)\n\n"
            "Screening & Application Details:\n"
            "Application decisions are made with individual circumstances in mind. Second-chance applicants with verifiable income "
            "and recent stability are welcome to apply."
        )
    },
    {
        "slug": "24th",
        "title": "Central Austin 2-Bedroom Condominium | West Campus / Central",
        "address": "806 W 24th St Apt 217",
        "city": "Austin",
        "state": "TX",
        "zip": "78705",
        "county": "Travis",
        "neighborhood": "West Campus / Central Austin",
        "lat": 30.2882,
        "lng": -97.7479,
        "property_type": "apartment",
        "bedrooms": 2,
        "bathrooms": 1,
        "square_footage": 715,
        "monthly_rent": 1425,
        "security_deposit": 1425,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Gated Community", "Swimming Pool", "Assigned Parking", "Private Balcony", "Hardwood Floors"],
        "appliances": ["Refrigerator", "Electric Range", "Microwave", "Dishwasher"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "Community Laundry",
        "parking": "Assigned Off-Street",
        "description": (
            "Enjoy prime central convenience at 806 W 24th Street Apt 217. Situated in a secured, gated residential complex "
            "in Central Austin, this bright 2-bedroom, 1-bathroom condominium places you within easy reach of Downtown Austin, "
            "Shoal Creek Trail, Pease District Park, and public transit corridors.\n\n"
            "This upper-level unit offers durable wood-look flooring throughout, recessed lighting, and a well-designed open "
            "floor plan. The kitchen includes stone countertops, a full appliance package with built-in microwave and dishwasher, "
            "and updated cabinetry. Two separate bedrooms provide ample privacy with built-in closets. Community amenities include "
            "a sparkling outdoor swimming pool, landscaped courtyards, and reserved parking.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 1 Full Bathroom\n"
            "• 715 Sq. Ft. of efficient central Austin living\n"
            "• Central heating and cooling system\n"
            "• Gated access community with swimming pool\n"
            "• Assigned parking space included\n"
            "• Private balcony overlooking courtyard\n"
            "• Wood-look flooring throughout\n"
            "• Pet-friendly community\n\n"
            "Screening & Application Details:\n"
            "We offer flexible application evaluations. Applicants with non-traditional credit or previous rental history "
            "discrepancies are reviewed holistically with verified income and solid employment."
        )
    },
    {
        "slug": "wateroak",
        "title": "Spacious 2-Bedroom Townhome in Jollyville / North Tech Corridor",
        "address": "13331 Water Oak Ln Unit A",
        "city": "Austin",
        "state": "TX",
        "zip": "78729",
        "county": "Travis",
        "neighborhood": "Jollyville / North Austin Tech Corridor",
        "lat": 30.4568,
        "lng": -97.7712,
        "property_type": "townhouse",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 1200,
        "monthly_rent": 1495,
        "security_deposit": 1495,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Vaulted Ceilings", "Private Patio", "Attached Garage", "Tile & Wood Flooring", "Dual Suites"],
        "appliances": ["Refrigerator", "Electric Range / Oven", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Attached Garage",
        "description": (
            "Located at 13331 Water Oak Lane Unit A, this charming two-story townhome provides comfort and functionality "
            "in the quiet Jollyville neighborhood of North Austin. Conveniently positioned off US-183 and McNeil Drive, the property "
            "offers quick access to the Austin Tech Corridor, Lakeline Station, and local parks.\n\n"
            "The main level showcases soaring vaulted ceilings, large windows, and resilient wood-style flooring in the central living area. "
            "The eat-in kitchen features updated countertops, generous pantry storage, and a complete suite of appliances. Each bedroom "
            "functions as an en-suite retreat with its own dedicated bathroom and walk-in closet. A private enclosed patio and attached "
            "garage complete this desirable home.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 1,200 Sq. Ft. of two-story interior living\n"
            "• Vaulted ceilings and generous natural light\n"
            "• En-suite bathrooms for both bedrooms\n"
            "• Central heating and cooling\n"
            "• Attached garage plus private driveway\n"
            "• Enclosed private patio for relaxation\n"
            "• Pet-friendly living (Dogs and Cats welcome)\n\n"
            "Screening & Application Details:\n"
            "Individualized tenant screening is provided. Second-chance applicants with steady earnings and verifiable proof of income "
            "are given thorough, considerate evaluation."
        )
    },
    {
        "slug": "leah",
        "title": "Peaceful 2-Bedroom Residence in Tanglewood Forest / South Austin",
        "address": "2202 Leah Cv Apt D",
        "city": "Austin",
        "state": "TX",
        "zip": "78748",
        "county": "Travis",
        "neighborhood": "Tanglewood Forest / South Austin",
        "lat": 30.1832,
        "lng": -97.8281,
        "property_type": "apartment",
        "bedrooms": 2,
        "bathrooms": 1,
        "square_footage": 810,
        "monthly_rent": 1400,
        "security_deposit": 1400,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Quiet Cul-de-Sac", "Private Balcony", "Off-Street Parking", "Wood-Style Plank Flooring"],
        "appliances": ["Refrigerator", "Electric Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Dedicated Off-Street",
        "description": (
            "Find your peaceful retreat at 2202 Leah Cove Apt D in the leafy, established Tanglewood Forest neighborhood "
            "of South Austin. Situated on a serene residential cul-de-sac, this home is just minutes away from Menchaca entertainment "
            "venues, Southpark Meadows shopping, and the Mary Moore Searight Metropolitan Park.\n\n"
            "The apartment offers a functional open layout with warm wood-style flooring across the main living and dining zones. "
            "The kitchen includes solid cabinetry, clean appliances, and an adjacent pantry space. Two bedrooms offer generous closets "
            "and privacy, with a well-maintained central bathroom. Enjoy morning coffee on your private balcony overlooking mature trees.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 1 Full Bathroom\n"
            "• 810 Sq. Ft. of comfortable interior space\n"
            "• Cul-de-sac setting in quiet residential neighborhood\n"
            "• Central air conditioning and heating\n"
            "• Functional kitchen with dishwasher and range\n"
            "• Private balcony with wooded views\n"
            "• Dedicated off-street parking\n"
            "• Pet friendly (Dogs and Cats welcome)\n\n"
            "Screening & Application Details:\n"
            "Our leasing approach emphasizes holistic review. Applicants working through past rental history or credit challenges "
            "are considered individually based on income verification and positive current tenancy."
        )
    },
    {
        "slug": "ptarmigan",
        "title": "Renovated 2-Bedroom Duplex in Gracy Woods / North Austin",
        "address": "11405 Ptarmigan Dr Unit B",
        "city": "Austin",
        "state": "TX",
        "zip": "78758",
        "county": "Travis",
        "neighborhood": "Gracy Woods / North Austin",
        "lat": 30.3995,
        "lng": -97.7011,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 1,
        "square_footage": 1070,
        "monthly_rent": 1400,
        "security_deposit": 1400,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Private Fenced Yard", "Covered Carport", "Wood-Look Flooring", "Fireplace", "Ceiling Fans"],
        "appliances": ["Refrigerator", "Electric Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Covered Carport",
        "description": (
            "11405 Ptarmigan Drive Unit B is a delightful 2-bedroom, 1-bathroom duplex home located in the desirable "
            "Gracy Woods community of North Austin. Located minutes from The Domain, Q2 Stadium, and North Star Greenbelt, "
            "this home combines peaceful residential living with unbeatable city connectivity.\n\n"
            "Inside, an expansive living area features a warm brick fireplace, high ceilings, and easy-to-clean wood-look vinyl plank "
            "flooring. The kitchen is outfitted with ample cabinet storage, a dishwasher, and a full-size refrigerator. Both bedrooms "
            "are well proportioned with generous closet space. Step out back to an expansive, private fenced yard shaded by mature oak trees.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 1 Full Bathroom\n"
            "• 1,070 Sq. Ft. of spacious single-level living\n"
            "• Brick fireplace in main living room\n"
            "• Efficient central heating and cooling\n"
            "• Fully fenced private backyard with shade trees\n"
            "• Covered carport parking\n"
            "• In-unit washer/dryer connections\n"
            "• Pet-friendly property\n\n"
            "Screening & Application Details:\n"
            "We offer compassionate, individualized tenant screening. Applicants seeking a fresh start are evaluated based "
            "on reliable income, stable employment, and verified rent affordability."
        )
    },
    {
        "slug": "dellrey",
        "title": "Updated 2-Bedroom Duplex Home in Gracy Woods | North Austin",
        "address": "12308 Dellrey Dr Unit A",
        "city": "Austin",
        "state": "TX",
        "zip": "78758",
        "county": "Travis",
        "neighborhood": "Gracy Woods / North Austin Tech Corridor",
        "lat": 30.4085,
        "lng": -97.6982,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 888,
        "monthly_rent": 1425,
        "security_deposit": 1425,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Private Fenced Yard", "Driveway Parking", "Tile & Plank Flooring", "Walk-In Closets"],
        "appliances": ["Refrigerator", "Electric Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Private Driveway",
        "description": (
            "Discover easy single-story living at 12308 Dellrey Drive Unit A in North Austin's Gracy Woods neighborhood. "
            "Tucked away on a quiet residential street, this home is surrounded by city parks, neighborhood trails, and offers "
            "fast commutes to the North Austin Tech Corridor, Kramer Station, and Austin FC soccer matches.\n\n"
            "This well-maintained 2-bedroom, 2-bathroom duplex features an inviting layout with durable plank flooring in the main "
            "living room. The kitchen has been updated with solid cabinetry, updated countertops, and clean appliances. The primary "
            "bedroom features an en-suite private bath and large walk-in closet, while the second bedroom has quick access to the second "
            "full bathroom. Enjoy outdoor activities in your fully enclosed private backyard.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 888 Sq. Ft. of practical single-level living\n"
            "• Split bedroom layout for optimal privacy\n"
            "• Central heating and cooling\n"
            "• In-unit laundry hookups\n"
            "• Private fenced backyard\n"
            "• Off-street driveway parking\n"
            "• Welcoming pet policy (dogs & cats welcome)\n\n"
            "Screening & Application Details:\n"
            "We employ an individualized review process. Past rental or credit history is considered in context, focusing on steady "
            "employment and verifiable monthly household income."
        )
    },
    {
        "slug": "rivercrossing",
        "title": "Bright 2-Bedroom Townhome in River Crossing | Southeast Austin",
        "address": "1815 River Crossing Cir",
        "city": "Austin",
        "state": "TX",
        "zip": "78741",
        "county": "Travis",
        "neighborhood": "River Crossing / Southeast Austin",
        "lat": 30.2312,
        "lng": -97.7124,
        "property_type": "townhouse",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 1059,
        "monthly_rent": 1450,
        "security_deposit": 1450,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Breakfast Bar", "Private Enclosed Yard", "Covered Parking", "Walk-In Closets", "Ceiling Fans"],
        "appliances": ["Refrigerator", "Electric Range / Oven", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Covered Carport",
        "description": (
            "Convenience meets comfort at 1815 River Crossing Circle in Southeast Austin. This 2-bedroom, 2-bathroom "
            "townhome is situated in an established residential community just minutes from Highway 71, Austin-Bergstrom International "
            "Airport, and the bustling South Shore / East Riverside entertainment districts.\n\n"
            "The home features a functional kitchen with a raised breakfast bar, modern cabinets, and a full appliance setup. The open "
            "living area connects directly to an enclosed private backyard, perfect for outdoor relaxation. Each bedroom is equipped "
            "with a walk-in closet, with two full bathrooms providing total privacy for roommates or families.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 1,059 Sq. Ft. of well-designed townhome living\n"
            "• Central heating and air conditioning\n"
            "• Kitchen with breakfast bar and modern appliances\n"
            "• In-unit washer and dryer connections\n"
            "• Private enclosed backyard\n"
            "• Covered parking space\n"
            "• Pet-friendly living (Dogs and Cats welcome)\n\n"
            "Screening & Application Details:\n"
            "Applications are reviewed on an individual basis. Second-chance applicants with verifiable income and reliable current "
            "tenancy are given fair, balanced consideration."
        )
    },
    {
        "slug": "hymeadow",
        "title": "Renovated 2-Bedroom Duplex in Anderson Mill | Northwest Austin",
        "address": "12817 Hymeadow Dr",
        "city": "Austin",
        "state": "TX",
        "zip": "78729",
        "county": "Travis",
        "neighborhood": "Anderson Mill / Northwest Austin",
        "lat": 30.4589,
        "lng": -97.7725,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 1020,
        "monthly_rent": 1450,
        "security_deposit": 1450,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Granite Countertops", "Private Fenced Yard", "Driveway Parking", "Tile Flooring", "Ceiling Fans"],
        "appliances": ["Refrigerator", "Electric Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Private Driveway",
        "description": (
            "12817 Hymeadow Drive offers a beautifully updated 2-bedroom, 2-bathroom duplex home located in "
            "Northwest Austin's desirable Anderson Mill community. Enjoy a serene residential setting with swift access "
            "to US-183, SH-45, Springwoods Park, and premier Northwest shopping and dining.\n\n"
            "The home has been refreshed with granite countertops in the kitchen, updated fixtures, and low-maintenance tile "
            "flooring throughout all living zones. Two generous bedrooms include spacious closets and two full bathrooms with modern "
            "vanities. The private, fully fenced backyard offers a shaded grassy yard and concrete patio for weekend barbecues.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 1,020 Sq. Ft. of updated interior space\n"
            "• Upgraded kitchen with granite counters and clean appliances\n"
            "• Central heating and cooling system\n"
            "• Fully fenced private backyard with patio\n"
            "• Private driveway with off-street parking\n"
            "• In-unit washer and dryer connections\n"
            "• Pet friendly (dogs & cats welcome)\n\n"
            "Screening & Application Details:\n"
            "We believe in second chances and evaluate applications holistically. Verifiable household income and recent positive "
            "rental references are key factors in our review process."
        )
    },
    {
        "slug": "thelma",
        "title": "Cozy 2-Bedroom Duplex in South Austin | Westgate",
        "address": "415 Thelma Dr Unit B",
        "city": "Austin",
        "state": "TX",
        "zip": "78745",
        "county": "Travis",
        "neighborhood": "Westgate / South Austin",
        "lat": 30.2215,
        "lng": -97.7942,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 950,
        "monthly_rent": 1400,
        "security_deposit": 1400,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Wood-Style Flooring", "Private Patio", "Dedicated Parking", "Ceiling Fans", "Spacious Closets"],
        "appliances": ["Refrigerator", "Electric Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Dedicated Off-Street",
        "description": (
            "Welcome to 415 Thelma Drive Unit B, a quiet and comfortable 2-bedroom, 2-bathroom duplex nestled in "
            "South Austin's convenient Westgate neighborhood. Located just minutes from Central Market Westgate, West Gate Transit Center, "
            "and Sunset Valley, this home is ideal for anyone seeking accessible South Austin living.\n\n"
            "The residence offers attractive wood-look flooring, fresh neutral interior paint, and a bright, open living room. "
            "The kitchen provides ample cabinetry, a double stainless sink, and clean appliances. Both bedrooms offer dedicated full "
            "bathrooms and generous closet storage. A private patio provides a quiet outdoor spot to unwind.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 950 Sq. Ft. of practical single-story living\n"
            "• Wood-style plank flooring throughout\n"
            "• Central heating and cooling system\n"
            "• In-unit washer/dryer connections\n"
            "• Dedicated off-street parking\n"
            "• Private patio and outdoor space\n"
            "• Pet friendly (dogs & cats welcome)\n\n"
            "Screening & Application Details:\n"
            "We offer an accessible, second-chance friendly screening evaluation. Applicants with past eviction or credit hurdles "
            "are reviewed individually based on proof of income and current stability."
        )
    },
    {
        "slug": "nuckols",
        "title": "Remodeled 2-Bedroom Duplex in Pleasant Valley | Southeast Austin",
        "address": "5106 Nuckols Crossing Rd Unit B",
        "city": "Austin",
        "state": "TX",
        "zip": "78744",
        "county": "Travis",
        "neighborhood": "Pleasant Valley / Southeast Austin",
        "lat": 30.1985,
        "lng": -97.7421,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 950,
        "monthly_rent": 1495,
        "security_deposit": 1495,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Quartz Countertops", "Private Fenced Backyard", "Driveway Parking", "Plank Flooring", "Modern Bath"],
        "appliances": ["Refrigerator", "Electric Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Private Driveway",
        "description": (
            "Experience contemporary comfort at 5106 Nuckols Crossing Road Unit B in Southeast Austin's Pleasant Valley "
            "corridor. Situated on a tree-shaded residential parcel, this home is moments from McKinney Falls State Park, "
            "I-35, and minutes from Downtown Austin.\n\n"
            "The home features a remodeled interior showcasing quartz countertops, stainless-style appliances, and durable faux wood "
            "plank flooring. The spacious open living room leads to two comfortable bedrooms with ceiling fans and ample closet space. "
            "Two modernized full bathrooms offer upgraded vanities and contemporary tile surrounds. A private, fenced backyard provides "
            "plenty of space for pets and quiet outdoor relaxation.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 950 Sq. Ft. of remodeled living space\n"
            "• Quartz countertops and modern cabinetry\n"
            "• Central heating and air conditioning\n"
            "• Fully fenced private backyard\n"
            "• Private off-street driveway\n"
            "• In-unit washer/dryer connections\n"
            "• Pet friendly (dogs & cats welcome)\n\n"
            "Screening & Application Details:\n"
            "Individualized application review is standard. Second-chance applicants with verifiable household income "
            "and dependable employment are welcomed and reviewed holistically."
        )
    },
    {
        "slug": "quailvalley",
        "title": "Charming 2-Bedroom Duplex in Quail Creek | North Austin",
        "address": "9011 Quail Valley Dr Unit A",
        "city": "Austin",
        "state": "TX",
        "zip": "78758",
        "county": "Travis",
        "neighborhood": "Quail Creek / North Austin",
        "lat": 30.3621,
        "lng": -97.7089,
        "property_type": "house",
        "bedrooms": 2,
        "bathrooms": 2,
        "square_footage": 950,
        "monthly_rent": 1475,
        "security_deposit": 1475,
        "application_fee": 50,
        "pet_deposit": 300,
        "pets_allowed": True,
        "has_central_air": True,
        "amenities": ["Central Air & Heat", "Private Fenced Yard", "Driveway Parking", "Ceiling Fans", "Wood-Style Plank Flooring"],
        "appliances": ["Refrigerator", "Electric Range", "Dishwasher", "Washer/Dryer Hookups"],
        "heating_type": "Central",
        "cooling_type": "Central Air",
        "laundry_type": "In-Unit Hookups",
        "parking": "Private Driveway",
        "description": (
            "Located at 9011 Quail Valley Drive Unit A in North Austin's quiet Quail Creek neighborhood, this 2-bedroom, "
            "2-bathroom duplex home offers clean, comfortable living in an established residential community. Close to Quail Creek "
            "Neighborhood Park, The Domain, and the North Lamar Transit Center, you are always well connected.\n\n"
            "The home features a functional layout with wood-style plank flooring, generous living area, and ceiling fans. The kitchen "
            "is equipped with clean cabinetry, a double sink, and electric range and dishwasher. Two private bedrooms feature roomy "
            "closets, accompanied by two full bathrooms. Outside, enjoy a private fenced yard shaded by mature trees.\n\n"
            "Property Features:\n"
            "• 2 Bedrooms, 2 Full Bathrooms\n"
            "• 950 Sq. Ft. of single-story living\n"
            "• Central heating and cooling system\n"
            "• Practical kitchen with clean appliances\n"
            "• Private fenced backyard\n"
            "• Off-street driveway parking\n"
            "• In-unit laundry hookups\n"
            "• Pet friendly (dogs & cats welcome)\n\n"
            "Screening & Application Details:\n"
            "We offer a fair and individualized screening process. Applicants looking for a second chance are evaluated on their "
            "verifiable monthly income and current residential stability."
        )
    }
]

def sb_post(table, data):
    """Inserts a record or list of records into a Supabase table with retries."""
    body = json.dumps(data).encode('utf-8')
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, data=body, headers=SB_HEADERS, method='POST')
            with urllib.request.urlopen(req, timeout=45) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            if e.code in (502, 503, 504) and attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            err_body = e.read().decode()
            print(f"  [ERROR] sb_post {table} HTTP {e.code}: {err_body}")
            raise
        except Exception as e:
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            print(f"  [ERROR] sb_post {table} Exception: {e}")
            raise

def main():
    print("==================================================================")
    print("Choice Properties — Publishing 15 Austin, TX 2-Bedroom Properties")
    print("==================================================================")
    
    published_links = []
    
    for idx, prop in enumerate(AUSTIN_PROPERTIES, 1):
        slug = prop['slug']
        print(f"\n[{idx}/15] Processing {prop['address']} (${prop['monthly_rent']}/mo | {prop['bedrooms']} Bed / {prop['bathrooms']} Bath)...")
        
        # 1. Upload photos to ImageKit
        raw_photos = PHOTO_SOURCES.get(slug, [])[:7] # Upload exactly 7 photos
        folder = f"properties/atx-{slug}"
        uploaded_photos = []
        
        def _upload_task(item):
            i, p_url = item
            fname = f"photo_{i+1:02d}.webp"
            ik_url, file_id = upload_to_imagekit(p_url, folder, fname)
            return i, ik_url, file_id
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            tasks = [executor.submit(_upload_task, (i, url)) for i, url in enumerate(raw_photos)]
            for fut in as_completed(tasks):
                i, ik_url, file_id = fut.result()
                if ik_url and file_id:
                    uploaded_photos.append((i, ik_url, file_id))
        
        uploaded_photos.sort(key=lambda x: x[0])
        print(f"  -> Uploaded {len(uploaded_photos)} verified photos to ImageKit")
        
        if len(uploaded_photos) < 6:
            print(f"  [ERROR] Not enough photos for {prop['address']} (got {len(uploaded_photos)}, need >= 6). Skipping.")
            continue
        
        # Check if property already exists in DB
        check_req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/properties?address=eq.{urllib.parse.quote(prop['address'])}&select=id",
            headers=SB_HEADERS
        )
        with urllib.request.urlopen(check_req) as c_resp:
            existing = json.loads(c_resp.read().decode())
        
        if existing:
            prop_id = existing[0]['id']
            print(f"  -> Property already in DB (ID: {prop_id})")
        else:
            # 2. Prepare property DB record
            prop_id = str(uuid.uuid4())
            prop_db_data = {
                "id": prop_id,
                "landlord_id": LANDLORD_ID,
                "status": "active",
                "title": prop["title"],
                "description": prop["description"],
                "address": prop["address"],
                "city": prop["city"],
                "state": prop["state"],
                "zip": prop["zip"],
                "county": prop["county"],
                "lat": prop["lat"],
                "lng": prop["lng"],
                "property_type": prop["property_type"],
                "bedrooms": prop["bedrooms"],
                "bathrooms": prop["bathrooms"],
                "total_bathrooms": prop["bathrooms"],
                "square_footage": prop["square_footage"],
                "monthly_rent": prop["monthly_rent"],
                "security_deposit": prop["security_deposit"],
                "application_fee": prop["application_fee"],
                "pet_deposit": prop["pet_deposit"],
                "pets_allowed": prop["pets_allowed"],
                "smoking_allowed": False,
                "has_central_air": prop["has_central_air"],
                "amenities": prop["amenities"],
                "appliances": prop["appliances"],
                "heating_type": prop["heating_type"],
                "cooling_type": prop["cooling_type"],
                "laundry_type": prop["laundry_type"],
                "parking": prop["parking"],
                "neighborhood": prop["neighborhood"],
                "featured": False
            }
            sb_post('properties', prop_db_data)
            print(f"  -> Inserted property into database (ID: {prop_id})")
        
        # 3. Insert property photos into `property_photos` if not already present
        p_check = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/property_photos?property_id=eq.{prop_id}&select=id",
            headers=SB_HEADERS
        )
        with urllib.request.urlopen(p_check) as pc_resp:
            existing_photos = json.loads(pc_resp.read().decode())
        
        if len(existing_photos) < len(uploaded_photos):
            if existing_photos:
                del_req = urllib.request.Request(
                    f"{SUPABASE_URL}/rest/v1/property_photos?property_id=eq.{prop_id}",
                    headers=SB_HEADERS,
                    method='DELETE'
                )
                urllib.request.urlopen(del_req)
            photos_batch = []
            for order, (_, ik_url, file_id) in enumerate(uploaded_photos):
                photos_batch.append({
                    "id": str(uuid.uuid4()),
                    "property_id": prop_id,
                    "url": ik_url,
                    "file_id": file_id,
                    "display_order": order,
                    "is_hero": (order == 0),
                    "watermark_status": "clean"
                })
            sb_post('property_photos', photos_batch)
            print(f"  -> Inserted {len(photos_batch)} photos into property_photos table (batch)")
        else:
            print(f"  -> {len(existing_photos)} photos already present in property_photos table")
        
        # 4. Construct live URL
        live_url = f"https://choice-properties-site.pages.dev/property.html?id={prop_id}"
        formatted_line = f"{idx}. {prop['address']}, {prop['city']}, {prop['state']} {prop['zip']} (${prop['monthly_rent']:,}/mo | {prop['bedrooms']} Bed / {prop['bathrooms']} Bath) — {live_url}"
        published_links.append(formatted_line)
        print(f"  -> LIVE: {live_url}")
    
    print("\n==================================================================")
    print("POST-PUBLISHING MANDATORY AI RESPONSE LIST:")
    print("==================================================================")
    for line in published_links:
        print(line)
        print()
    
    # Save output to a file for verification
    with open('scripts/austin_published_results.json', 'w') as f:
        json.dump(published_links, f, indent=2)

if __name__ == '__main__':
    main()
