-- Choice Properties: Tulsa 21 Private Placement Portfolio Publication
BEGIN;

-- 1. Insert Property Share
INSERT INTO public.property_shares (id, token_hash, expires_at, created_at)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'a96c34b5d82fee316b49b1c1b63517cf7053d57345821dde58e6b8140fc75f3a', '2027-02-09T17:32:26.627Z', NOW())
ON CONFLICT (id) DO UPDATE SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at;

-- Property 1: 2505 E 88th St S #63a40140b
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-1B32BBFC', '2 Bed / 2 Bath in Tulsa', 'Nestled in desirable South Tulsa within the acclaimed Jenks School District, 2505 E 88th St S #63a40140b presents a thoughtfully planned two-bedroom residence combining everyday ease with generous neighborhood recreation. The entrance opens into a sun-filled open layout complemented by durable wood-style flooring and neutral designer tones throughout.

The contemporary kitchen features ample prep countertops, expansive cabinetry, a refrigerator, cooking range, dishwasher, and microwave, transitioning smoothly into the adjacent dining and entertaining area.

Two sizable private bedrooms offer substantial closet space, with two full bathrooms showcasing clean fixtures, bright lighting, and integrated tub-shower enclosures.

Interior washer and dryer connections ensure home convenience, supported by high-efficiency central heating and air conditioning. Outside, residents enjoy premier community grounds complete with an outdoor swimming pool, fitness center, soccer field, and picnic areas.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '2505 E 88th St S #63a40140b', 'Tulsa', 'OK', '74137', 'Tulsa County', 36.037964, -95.95191,
  'APARTMENT', 2, 2, 0, 1020, 8500, 1986,
  1000, 1000, 50, 'Off-Street Residential Parking Lot', 0, 'Hookups',
  '["Refrigerator","Range/Oven","Dishwasher","Microwave"]'::jsonb, '["Outdoor Swimming Pool","Modern Fitness Center","Resident Clubhouse","Soccer Field & Picnic Grounds","Playground","Central HVAC"]'::jsonb, '["Wood-Style Flooring","Ceramic Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-1B32BBFC';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/0121d99e2069755037b9ff0363149129-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/a08588c1abc5ee46a585c08f1678675a-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/4ee1842a967b96a242a7b7a973b7d19d-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/377f55ce934a6fa524ff97693cbe20fc-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/a46c25b3fa46f4c6c624ca9ff69d7ac9-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/a39bbc24a0198b3234d67605b13bbc6f-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/5c194a6c6c70cdb78236afd24bce9353-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/bebdd00941cc3bbfa606944b6b40bd5b-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/b936478709a2b376caa3a863eacb973c-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/4718e6ca1848f068dc03ac989231d023-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/9cd66781cb30d0722764e392dcca9fb3-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/19fb56551455e037d83146b70b3b216a-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/dba3ef173f9353c6fe347c17057eddc8-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/10772a405d2e96959c68e7224df565ed-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/0c7d94ad56073df42eb03dacbaa3b7f1-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/c1c7b77a47c2c43432555ab55c003505-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/10823de619516d260e87c784b2fb71d4-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/f41043fe63f8ad58e1dce44942e46ba1-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/8039369dcd97153265ae3754ecc6f58b-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/8fb9a4caf25b5ad21ca7f5cd2697383e-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/412ffef6a1967e391c60ca08ba739f25-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/2efbbcc35e53cb4910761d7821ceffac-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/a309ddcf0d1cf6757407e708c99a250c-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/a606da1d9c6f25bb6fcbf9d000b94bf9-uncropped_scaled_within_1536_1152.jpg', 24, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/272f5dbc1a3e46179246ef77a41fd823-uncropped_scaled_within_1536_1152.jpg', 25, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/680866381e1eb1882d473f4e8c4502e7-uncropped_scaled_within_1536_1152.jpg', 26, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/eb63ba194f589d257aa834697d5b888f-uncropped_scaled_within_1536_1152.jpg', 27, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/6a8c3dd35fb63ff5491dfd8f59b6dbd9-uncropped_scaled_within_1536_1152.jpg', 28, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/bc40e1d9a415fd4ea3b120b6fad928b9-uncropped_scaled_within_1536_1152.jpg', 29, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/c6f7088c47f09d4639e86970b65ecf4f-uncropped_scaled_within_1536_1152.jpg', 30, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/46132d8c1e6abf45ed65a13f7c16eda1-uncropped_scaled_within_1536_1152.jpg', 31, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/f696e8aa79b7924e728b07da22224d6d-uncropped_scaled_within_1536_1152.jpg', 32, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/3508e4173f2f412b5ceca12f33ea5f4c-uncropped_scaled_within_1536_1152.jpg', 33, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/a8d69b52cf53f4afc0ba1f186efdb356-uncropped_scaled_within_1536_1152.jpg', 34, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/4cdd92cd3be58497c7475c045ddc4a10-uncropped_scaled_within_1536_1152.jpg', 35, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/85647bb6e00160a3c3901d43055b2c0d-uncropped_scaled_within_1536_1152.jpg', 36, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1B32BBFC', 'https://photos.zillowstatic.com/fp/d6c1b0e8c216e66b2c95cfe41705a926-uncropped_scaled_within_1536_1152.jpg', 37, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-1B32BBFC')
ON CONFLICT DO NOTHING;

-- Property 2: 8812 S Delaware Ave #25125
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-186449FF', '2 Bed / 2 Bath in Tulsa', 'Situated within the peaceful, tree-lined enclave of Deerfield Estates in South Tulsa, 8812 S Delaware Ave #25125 offers a fluid, open-concept living design. The expansive living room provides unobstructed sightlines extending from the kitchen through the central entertaining space, accentuated by oversized picture windows.

The efficient culinary area is outfitted with dependable refrigeration, electric range oven, dishwasher, and ample counter prep space for everyday cooking and meal hosting.

Two comfortably proportioned bedrooms feature deep wardrobe closets, paired with two full bathrooms appointed with modern vanity basins and easy-care tile surrounds.

Equipped with in-home washer and dryer hookups and central forced-air climate control. Enjoy community amenities including a 24-hour fitness facility, business center, and swimming pool, moments from local shopping and dining.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '8812 S Delaware Ave #25125', 'Tulsa', 'OK', '74137', 'Tulsa County', 36.036896, -95.95031,
  'APARTMENT', 2, 2, 0, 980, 8000, 1985,
  1000, 1000, 50, 'Dedicated Off-Street Parking', 0, 'Hookups',
  '["Refrigerator","Electric Range/Oven","Dishwasher","Garbage Disposal"]'::jsonb, '["24-Hour Fitness Center","Executive Business Center","Sparkling Swimming Pool","Open Living Concept","Central HVAC"]'::jsonb, '["Plush Neutral Carpeting","Ceramic Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-186449FF';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/32e702fd9613a52dd83a04f88ca91e56-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/c1df9e36bfdf36196f718294fcc4670f-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/1e69e3b565d1bce6f5b25527dc7ce213-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/3b200ab99370575344fd88dbf9cd4d6a-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/26442515dc3e4a26ee7dc089791fa372-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/d733365cdcb394f94b7889c6e0128fa3-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/7c65125d82d8821df8338b0a56a92f7d-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/e024b6f4aafb3cec8339b363b3f6630d-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/0dbbab0a77f9e138ad4b9c5486e0626a-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/f7acdae6cfba1b5cd024deb81a5d3fac-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/33a6cdc541dcfa0342a895a130b462de-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/061bc5a8b55d4cf2531d07dbc66cab25-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/59a8f93f1edbb863a7ac3f65d5001466-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/ab5c51638bbdf0ecde23f7ad1c3ad1c7-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/6b12144551cf5867850f84814bcedd31-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/d7efa1f37b5d10c89b7df8192abc78e5-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/8d6d1e9f6efb6111685de19ab36e01cb-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/f2642e176adc7522a19eba3ad976e0d5-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/0a246f789638ebbc098406145c6ef7c1-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/28ce0ecc5cb3c9da9e9eef229fb463ac-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/a25f48e30746a63fc89bbfc34e864107-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/3542d06fc3f8f863f56811279815d5d5-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/b7faf386e9676d4e2b9b6ac535800200-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/dc8ca2cd7f48901286119868e481eb3c-uncropped_scaled_within_1536_1152.jpg', 24, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/349c44912a25aeb589c083446b2df5a4-uncropped_scaled_within_1536_1152.jpg', 25, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/b82b2f31b3cd8d7794bf7f557127b6f7-uncropped_scaled_within_1536_1152.jpg', 26, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/fc11aa3fe6c8c2ec41841b5bf9f10160-uncropped_scaled_within_1536_1152.jpg', 27, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/7ebc50620ce047302c6855d97715b9d2-uncropped_scaled_within_1536_1152.jpg', 28, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/da10007a1cbae9b6c304209047e62077-uncropped_scaled_within_1536_1152.jpg', 29, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/6409cc1d8a851d8069aeb25f4e4f8d40-uncropped_scaled_within_1536_1152.jpg', 30, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/77e9145677c73ed39537f58f15fe656f-uncropped_scaled_within_1536_1152.jpg', 31, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/dbed1755380721484b182e13217f4246-uncropped_scaled_within_1536_1152.jpg', 32, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/7040ebfffcdfe4608b81b75205d34584-uncropped_scaled_within_1536_1152.jpg', 33, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/7716e9266d0958ff1c51cde646c1eb60-uncropped_scaled_within_1536_1152.jpg', 34, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/ce1a2b20c83219eb2e7a0b70e88a39f1-uncropped_scaled_within_1536_1152.jpg', 35, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/c1ca68ddb9312036994fc8237795c199-uncropped_scaled_within_1536_1152.jpg', 36, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/ed19eed4b4c41e973d3259835650beed-uncropped_scaled_within_1536_1152.jpg', 37, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/86cc031c0ceb4b497f49b8320e82411e-uncropped_scaled_within_1536_1152.jpg', 38, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/2e9a17d8a9e5f85b250f8e4eaa5ee701-uncropped_scaled_within_1536_1152.jpg', 39, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/9e594601d4fd114c6be1415fcd4ef384-uncropped_scaled_within_1536_1152.jpg', 40, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/438b563d6ce185d19114a9e3f944d1b7-uncropped_scaled_within_1536_1152.jpg', 41, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/807c3d5265dbe666f0233e4ca678542c-uncropped_scaled_within_1536_1152.jpg', 42, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/dc5603ae128031c6730e263d10927ece-uncropped_scaled_within_1536_1152.jpg', 43, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/c489bc23f8f9ee84644e1a97b5b3450a-uncropped_scaled_within_1536_1152.jpg', 44, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/7175f6bf2dfa350d1f81d61150447883-uncropped_scaled_within_1536_1152.jpg', 45, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/fdcd5265932f23b37b421e1d86da8b53-uncropped_scaled_within_1536_1152.jpg', 46, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/074607c01ff14a1120caa93cbc9c304f-uncropped_scaled_within_1536_1152.jpg', 47, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/4400c1624c9719254a25d545bad20f13-uncropped_scaled_within_1536_1152.jpg', 48, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/b9c7a305377c0869ce8b67577a8994ef-uncropped_scaled_within_1536_1152.jpg', 49, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-186449FF', 'https://photos.zillowstatic.com/fp/57172aecbcffee1679c87c0f514b7c59-uncropped_scaled_within_1536_1152.jpg', 50, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-186449FF')
ON CONFLICT DO NOTHING;

-- Property 3: 5477 E 71st St #53
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-792035C4', '2 Bed / 2 Bath in Tulsa', 'Prominently positioned along Tulsa’s vibrant 71st Street corridor at Regency Point, 5477 E 71st St #53 pairs serene manicured landscaping with immediate metropolitan accessibility. The front foyer introduces a spacious, light-drenched living room with modern luxury vinyl plank flooring and clean architectural lines.

The kitchen is equipped with full cabinetry, generous prep surfaces, a cooking range, refrigerator, and built-in dishwasher, flowing into an intimate dining nook.

Two quiet bedrooms provide restful retreats with broad closet capacity and direct access to two well-maintained full bathrooms with contemporary vanity fixtures.

Offers dedicated laundry hookups, central air conditioning, and convenient covered parking, situated minutes from premier dining, retail centers, and regional recreation.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '5477 E 71st St #53', 'Tulsa', 'OK', '74136', 'Tulsa County', 36.061203, -95.91576,
  'APARTMENT', 2, 2, 0, 1050, 7500, 1983,
  1000, 1000, 50, 'Covered Off-Street Parking', 0, 'Hookups',
  '["Refrigerator","Range/Oven","Dishwasher","Built-In Microwave"]'::jsonb, '["Lush Landscaped Courtyard","Resort-Style Pool","71st Street Corridor Access","Spacious Private Layout","Central Air"]'::jsonb, '["Luxury Vinyl Plank","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-792035C4';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/22a866b6729658da65dcdb27a15485d2-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/17087f445db254bda7c72fb027cfd786-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/7859f032ee08ef3f34c4b187ae87b12f-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/38cbeaced335cff6d942b850b0e852c2-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/604cf401eab96e5e19337808811260c4-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/7b0c3f728baa437dc04448546a3b967f-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/b912df7da70863926a92bcf6f1fe1228-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/d7777becc3c75eca6fefa3ed8b411fba-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/ecd401fdc1704e16a73c2c1b9aebe36a-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/58890de0e73e298c5ec391f27faf482b-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/fdf69e02a773f3f0fc8ab125491ac534-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/f412d1afed17f42e2ea176e4a7e7e088-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/332c398d68aa59ca7eec1ca05e29f719-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/98776bbcb50fe7aa3cde388438cee448-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/0f0db4520a14cd20464945b7e2004319-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/d9aa007b29f0367680bae691128bcce9-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/5fc5c553f8fc81e384569e32de9203b7-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/5879b491f1542cbcb4ce34a2772f4aef-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/24a2c25433a096dd77a0bd2496b17db9-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/dd7623c965f83d110e5888ee4e7eabce-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/9087ab19e294d57b42c72ebf3a06bd18-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-792035C4', 'https://photos.zillowstatic.com/fp/7bbe66738a07a0aa4d55d46da7ba8133-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-792035C4')
ON CONFLICT DO NOTHING;

-- Property 4: 6339 S 33rd West Ave
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-D9D84F21', '2 Bed / 2 Bath in Tulsa', 'Set in scenic West Tulsa at The Arden Overlook within the Jenks school district, 6339 S 33rd West Ave combines natural surroundings with convenient urban connectivity. The entrance welcomes you into an airy open living room framed by large windows and easy-care hard-surface flooring.

The kitchen is equipped with durable cabinetry, full refrigeration, a cooking range, and dishwasher, offering seamless connectivity to the dining space.

Two private bedrooms feature expansive closets, supported by two full bathrooms finished with clean surfaces and full tub-shower combinations.

Includes in-home washer/dryer hookups and central climate control. Community perks include a refreshing pool, outdoor grilling pavilion, and business center, located minutes from Turkey Mountain trails and Riverwalk dining.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '6339 S 33rd West Ave', 'Tulsa', 'OK', '74132', 'Tulsa County', 36.071717, -96.028878,
  'APARTMENT', 2, 2, 0, 950, 7200, 1980,
  1000, 1000, 50, 'Off-Street Parking', 0, 'Hookups',
  '["Range/Oven","Refrigerator","Dishwasher"]'::jsonb, '["Swimming Pool","Business Center","Picnic & Grilling Pavilion","Near Turkey Mountain & Riverwalk","Jenks District","Central HVAC"]'::jsonb, '["Hard Surface Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-D9D84F21';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/3fb57807939f66dbd57263ba1d747832-cc_ft_1536.webp', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/e2b980f4b37f584f508d2200cf734a5e-cc_ft_1536.webp', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/61e8dbac1e4938afadae4d15ae438697-cc_ft_1536.webp', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/2ff68b391aee2efa0bf2601a76546d0a-cc_ft_1536.webp', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/4caf312073bdfb3ba56d22fa13b8ad88-cc_ft_1536.webp', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/9129c648948050c475f76bff8a5a391b-p-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/c47a2b4b03fffca6ea486fdc0382130f-p-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/a818e72d126ab0902371a5f8c56c1c39-p-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/d393c3849845d3c814e819621e858822-p-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/ae0100e62ff37d4a5b5d7a2ec13d0a84-p-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/4b8dfd80e103ed4b754aa65a43c82076-p-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/434208c7f57b145b9f83b78aecc21641-p-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/6008395b58a8469cd9568d8a1711cea8-p-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/c98cdbf5a287de2a651feebe98751b3b-p-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/b70dba97f054574085dc96ee3167eb4f-p-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/b9bff3a50d132f207e88b213bb12d9ad-p-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/2eb8d163f47cac58ccc74b196c26fa40-p-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/6267472c1ff6f2a415f6a7efbb7c2c38-p-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/6ace4eef3ac7b8ad5176cfd1ea846d17-p-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/dff4e8a086dd62b8963f23ca699249fe-p-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/e18de15cfaba0fd00024d14232232d55-p-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/9d9ea4541caec11336c2cb94893b3c0b-p-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-D9D84F21', 'https://photos.zillowstatic.com/fp/9cb2335bec32c8e59a1ac9a4426a26b8-p-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-D9D84F21')
ON CONFLICT DO NOTHING;

-- Property 5: 8502 E 66th Pl #644D
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-E6A5A30E', '2 Bed / 2 Bath in Tulsa', 'Situated in the bustling heart of South Tulsa near Woodland Hills Mall, 8502 E 66th Pl #644D showcases newly updated contemporary interiors with a modern gray palette and sleek wood-style flooring throughout the primary living areas.

The culinary space is equipped with modern cabinetry, an electric cooking range, dishwasher, and refrigerator, opening directly to the central living and dining zone.

Two well-proportioned bedrooms boast roomy walk-in closets, accompanied by two full bathrooms with updated vanities and clean tub-shower combinations.

Equipped with in-unit washer/dryer connections and central air conditioning. Community features include manicured green spaces and an expansive swimming pool, with rapid transit access across the metro.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '8502 E 66th Pl #644D', 'Tulsa', 'OK', '74133', 'Tulsa County', 36.067223, -95.88056,
  'APARTMENT', 2, 2, 0, 960, 7800, 1982,
  1000, 1000, 50, 'Off-Street Parking', 0, 'Hookups',
  '["Electric Range/Oven","Dishwasher","Refrigerator"]'::jsonb, '["Renovated Gray Tone Scheme","Large Swimming Pool","Green Spaces","Near Woodland Hills Mall","Central HVAC"]'::jsonb, '["Wood-Style Gray Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-E6A5A30E';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/3dcd1bc4bdb959bb8017c242ee9bea57-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/c599f9d1a31a2dcb991202d3ed1101e9-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/848666105c4b5e18bc3fe07c0ea3182c-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/ac79447f328ec220ec5457c79065b68f-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/f49c04540fd9c33c4092d2012a949c84-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/7eece2abbd5649cec6e48f9f4787bcbc-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/0d465042924986513f79a3d95ded4245-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/179fc1bdd5202b5cef19f6db3260dd15-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/cdc0728967ac6806f639da5083672288-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/ed7181cedcff60a5a45f4588f39c2e3c-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/3d419989c5f0a9966dbdc2eeb912862a-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/abb695151870563b4029e894673686c0-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/cc0565e75434ab3c86c9767772ee54bb-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/f07f7a1a54893e9cb8497c13f90e7af9-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/0aa1027ed06c58ae939466f98bb40bda-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/5f99356b930f3148bdef5f8bf133aa13-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/0d170f17a3e0fafaf9409050a32fe0c9-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/ca68d919eaf78f799c919028ddcfc2a5-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/4eeed98b09f7253b2d1f50fd7ab7056e-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/e66b0e98dd2d49155249a4db27a68129-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/7b226e4c6d51303beffba83cf9d6d17a-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/0e880eb3c7564f7e7dec9646cf5347fc-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/0bfb0a01e1650533308e38ba031a4e96-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/30dc241df06aacd3c87594fd22d0c455-uncropped_scaled_within_1536_1152.jpg', 24, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/e87d77bce1e3106b08dba88f7435bb75-uncropped_scaled_within_1536_1152.jpg', 25, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/a8cb3ae2345968e8baf4d3deaaab9670-uncropped_scaled_within_1536_1152.jpg', 26, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/445cac0b160f0b2daa745a1d1e0b94c9-uncropped_scaled_within_1536_1152.jpg', 27, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/2101ce745c9057fee294820f539a4b3d-uncropped_scaled_within_1536_1152.jpg', 28, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/32c778d2ebe0df98547310ce6a3c7284-uncropped_scaled_within_1536_1152.jpg', 29, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/e6592d654184676b36d0416b014496de-uncropped_scaled_within_1536_1152.jpg', 30, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/1ce15440379d0e654a5a3eb499fad636-uncropped_scaled_within_1536_1152.jpg', 31, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/a616d1768e4d5916f8d516f89c9e32f2-uncropped_scaled_within_1536_1152.jpg', 32, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/5f50a97f0929f5e19b9d03ecb25259af-uncropped_scaled_within_1536_1152.jpg', 33, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/68e58c1d19f21d509031ba81d553698c-uncropped_scaled_within_1536_1152.jpg', 34, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/033c71d22c41ac9b097e9fb71fddfc17-uncropped_scaled_within_1536_1152.jpg', 35, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/2fab0c9dd48a81daba15a79dfd8cfa01-uncropped_scaled_within_1536_1152.jpg', 36, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/fb61fe2da29b36ff7b4c82871441903e-uncropped_scaled_within_1536_1152.jpg', 37, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/2dc2add86dc80b7dbe7e49bb75a457c1-uncropped_scaled_within_1536_1152.jpg', 38, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/489bb0bc8b3a893e83660990cb1e5a59-uncropped_scaled_within_1536_1152.jpg', 39, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/b01984d425bd2f9ef0335e23c719aea3-uncropped_scaled_within_1536_1152.jpg', 40, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/b451043561fd6fef6819f43d9d827ad3-uncropped_scaled_within_1536_1152.jpg', 41, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/63c55464a9d15fe908e1580dcc281edc-uncropped_scaled_within_1536_1152.jpg', 42, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/b605357a7de0773504d162cbcf7c7449-uncropped_scaled_within_1536_1152.jpg', 43, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-E6A5A30E', 'https://photos.zillowstatic.com/fp/6d783eec823379b572e40426e233eaf8-uncropped_scaled_within_1536_1152.jpg', 44, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-E6A5A30E')
ON CONFLICT DO NOTHING;

-- Property 6: 12903 E 35th Pl #1410
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-4DCC002D', '2 Bed / 2 Bath in Tulsa', 'Located in East Tulsa within the Union School District at Sawmill, 12903 E 35th Pl #1410 provides a refreshed interior with fresh paint, updated flooring, and an intuitive layout. The bright living room offers an inviting reception space with easy circulation into the dining area.

The kitchen provides dependable meal preparation utilities with an oven and range, dishwasher, refrigerator, and built-in microwave.

Two private bedrooms feature comfortable proportions and ample closet storage, served by two clean full bathrooms with updated fixtures and tub surrounds.

Includes dedicated in-unit washer and dryer hookups and high-efficiency central HVAC. Fast highway connections to I-44 and Highway 169 put Downtown Tulsa and Tulsa International Airport within swift reach.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '12903 E 35th Pl #1410', 'Tulsa', 'OK', '74134', 'Tulsa County', 36.112816, -95.83151,
  'APARTMENT', 2, 2, 0, 980, 7500, 1985,
  1000, 1000, 50, 'Dedicated Off-Street Parking', 0, 'Hookups',
  '["Dishwasher","Range/Oven","Refrigerator","Microwave"]'::jsonb, '["Fresh Paint & Trim","Union Schools District","Quick Access to HWY 169 & 44","Central HVAC"]'::jsonb, '["New Hard Surface Flooring","Plush Bedroom Carpet"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-4DCC002D';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/7abce830b65e38e0e71087771a5c31ea-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/dbfa395c7c4204a0d42bfc72c7434c7d-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/d5aa31238780de0393e452f190955f0d-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/89e40102f7df08f8caa49d784bdac3a9-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/0e110bfd83ffeaf9179bf4c1fe656d6c-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/831ff2230061f2cad0163dfebaf81f37-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/1eb827c32d7b03a8bca454ec8dd235d2-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/56b416ed89fa0868580158a49aded257-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/b8beaa7edfcc09d77a139d3128b2bef5-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/eeebb755eff01aa28b88246b7869b86f-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/a2d7668c5c939fcf6be671c50dde3627-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/2c5cef7708d946c457b57e538b182211-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/52a98eb46a8fee586a8c8538d7d2297b-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/ea272f8e19624ebc0a1d641c12c8a5ef-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/e8c0d82c3b3cce018bea0c1382a047a0-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/d38a4617810a135ad978ed551ca60197-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/43f5df133aaf384c5fa51a9cb08a8145-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/77fd684579c607133b59bcb23c4a57a8-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/8c8824d46bd3d49fb8fc107a4260ce79-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/a0ca2041c02ff5f78b79053950ac490c-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/f28288d3c688a2f9ddfeb864639f165d-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/239e58d222e3a08bfd839ff7db4d14f9-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/65d1062b8b35d0bce577f94ca834c760-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/0918e93279b38f8dfff52f31bafed155-uncropped_scaled_within_1536_1152.jpg', 24, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4DCC002D', 'https://photos.zillowstatic.com/fp/ccf06c77e4cdd8d1f6274a2acfd2e811-uncropped_scaled_within_1536_1152.jpg', 25, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-4DCC002D')
ON CONFLICT DO NOTHING;

-- Property 7: 4747 S Darlington Ave #Aea19e8b1
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-71997287', '2 Bed / 2 Bath in Tulsa', 'Positioned in convenient Midtown Tulsa at Midtown Reserve, 4747 S Darlington Ave #Aea19e8b1 spans an impressive 1,003 square feet of comfortable living space. The spacious living room features resilient hard-surface flooring and ample daylight.

The practical kitchen offers solid countertop surfaces, integrated cabinetry, cooking stove, refrigerator, and dishwasher, opening to a bright dining space.

Featuring two generously sized bedroom suites with walk-in closet space, this home includes two full bathrooms with modern vanities.

Equipped with in-unit laundry hookups and central heat and air conditioning. Centrally located for effortless cross-town commuting and quick access to neighborhood shopping.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '4747 S Darlington Ave #Aea19e8b1', 'Tulsa', 'OK', '74135', 'Tulsa County', 36.094303, -95.917015,
  'APARTMENT', 2, 2, 0, 1003, 7000, 1974,
  980, 980, 50, 'Off-Street Parking', 0, 'Hookups',
  '["Refrigerator","Stove/Range","Dishwasher"]'::jsonb, '["Spacious Double Master Layout","Modern Countertops","Midtown Corridor","Central HVAC"]'::jsonb, '["Hard Surface Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-71997287';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/c98cdbf5a287de2a651feebe98751b3b-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/bc177ab5a65bdd8512aa546a94777bbf-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/3f23b3e44d03cdf7451e3eaa8f04c1bd-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/d8d5ea60aa522207c82fcdf1ffa8994e-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/943459292979f4b4eb1f0bf15dbc3417-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/e15f678850f0ffcff376af094608744c-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/2874e72af5c59f40da48a144743ccf5f-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/da0ae54163b3822b98818af7bf39700f-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/1a0ac2073840d05077527c728339f27a-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/224ffe7f0b61ed911703686502f04dca-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/a620264d663ec42137c2f2ac3db7683a-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/91ebf38455d2ccdde467a5bf6a418f46-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/b9e30cb79def2a589d27db6916a307d1-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/6038fdc690530ea76aace163047ffdc5-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/95c2344881afa50b04ce8bcafb3f067d-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/208da4d4cc09216e0f7db6c81d84cb78-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/d172a3fc94caa83d1d4e2df4cb12d537-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/e11b788ddb673d8919a770f461ce13b7-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/e1caced23058c39af6517eb197ae3618-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/91281583e048e113b5371f7e7d804d3c-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/0ac6016f711f10f28a94464e07a7f7a7-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/c15082952e90600c3a40ade54c9956f4-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/1904a4a1853d07c5a72b73a84fa455b8-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/61f5ce2e311d3c0a537856990f202c91-uncropped_scaled_within_1536_1152.jpg', 24, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/eb004ddde4034ae0aa66bf78baa7edef-uncropped_scaled_within_1536_1152.jpg', 25, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/fc73e34e924ef88df8f12d60a49de0ba-uncropped_scaled_within_1536_1152.jpg', 26, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/78100c50b7f82e2f50d8d72d7ee2e803-uncropped_scaled_within_1536_1152.jpg', 27, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/caa93ad6534332e8b98e56ad8fcc324c-uncropped_scaled_within_1536_1152.jpg', 28, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/ecfcc636f231173d1391891d15f456fa-uncropped_scaled_within_1536_1152.jpg', 29, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/4f601ba0a22f875056f383bf12b0ea29-uncropped_scaled_within_1536_1152.jpg', 30, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/e86a6728f7997372d9198cdbcb427401-uncropped_scaled_within_1536_1152.jpg', 31, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/f05447018592d325d1f24f5db59a9761-uncropped_scaled_within_1536_1152.jpg', 32, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/4bac2941934c98117d52b9d13c384648-uncropped_scaled_within_1536_1152.jpg', 33, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/816e9f358ea74acf2f1a1fea9a0db021-uncropped_scaled_within_1536_1152.jpg', 34, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-71997287', 'https://photos.zillowstatic.com/fp/631d8c1ea50d286e90c22be9bd147a70-uncropped_scaled_within_1536_1152.jpg', 35, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-71997287')
ON CONFLICT DO NOTHING;

-- Property 8: 4858 S 78th East Pl
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-35A935DF', '2 Bed / 2 Bath in Tulsa', 'Nestled in a peaceful residential enclave at Cedar Park in Tulsa, 4858 S 78th East Pl offers a low-maintenance, two-bedroom home with an open interior layout. Sunlight fills the welcoming living area, finished with durable wood-style vinyl flooring.

The kitchen is equipped with essential cooking appliances including a range oven, dishwasher, and refrigerator, complemented by a convenient dining nook.

Both bedrooms provide peaceful sleeping quarters with dedicated closet storage, complemented by two full bathrooms with modern fixtures.

Features in-unit laundry connections, central heating and cooling, and a private patio space looking out onto landscaped community grounds.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '4858 S 78th East Pl', 'Tulsa', 'OK', '74145', 'Tulsa County', 36.093462, -95.889676,
  'APARTMENT', 2, 2, 0, 920, 7200, 1979,
  1000, 1000, 50, 'Off-Street Parking', 0, 'Hookups',
  '["Range/Oven","Dishwasher","Refrigerator"]'::jsonb, '["Courtyard Views","Walk-In Closets","Private Patio","Central HVAC"]'::jsonb, '["Hardwood-Style Vinyl","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-35A935DF';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/90e164d241580c3da4210716fed0ec4f-cc_ft_1536.webp', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/ef6d570c77ef9fb4875b8e77e3a0c654-cc_ft_1536.webp', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/376cdcc29459606680d50115fe67a14c-cc_ft_1536.webp', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/6ecc92a3367636061052c8d62f2c26bf-cc_ft_1536.webp', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/b2ceeb4c304b0d88cb9c9e156c99a141-cc_ft_1536.webp', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/9da99ed66c410071c6be74776f1a9fae-r-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/5a74218ec58546d375e0c45acaf33935-r-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/001c57b214deddef396c800a444e754a-r-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/7ee64acadeb2803950dbd7521eacf309-p-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/40cb98f9bf8c7683ddbb680dde83e432-p-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/c2213fc0c7858d71027e84ba85bdf8f5-p-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/5dad78680af017623d0bb60aba2387e3-p-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/4fa9220f70e4088453e5181ab0ae8b74-p-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/c4dac89d826a75edd813217d792128d3-p-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/5673dc03dddebe60f0007f057cddc9a9-p-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-35A935DF', 'https://photos.zillowstatic.com/fp/6267472c1ff6f2a415f6a7efbb7c2c38-p-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-35A935DF')
ON CONFLICT DO NOTHING;

-- Property 9: 3901 S Garnett Rd #24M2
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-DFB5577E', '2 Bed / 2 Bath in Tulsa', 'Situated at 3901 S Garnett Rd #24M2 in East Tulsa, this 946-square-foot residence features a smart two-bedroom, two-bathroom configuration. The entry leads into a bright main living space with easy-care laminate flooring and neutral wall tones.

The culinary center is equipped with a refrigerator, cooking range, and dishwasher, complete with functional counter space for daily meal preparation.

Two distinct bedrooms ensure privacy for residents, each featuring generous wardrobe storage and immediate proximity to two clean, full bathrooms.

Includes dedicated in-unit laundry connections and central heating and air conditioning, situated near major employment hubs and shopping centers.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '3901 S Garnett Rd #24M2', 'Tulsa', 'OK', '74146', 'Tulsa County', 36.107174, -95.84989,
  'APARTMENT', 2, 2, 0, 946, 7100, 1973,
  1000, 1000, 50, 'Off-Street Parking', 0, 'Hookups',
  '["Range/Oven","Dishwasher","Refrigerator"]'::jsonb, '["Dual Full Bathrooms","Efficient Single-Level Layout","Central Climate Control"]'::jsonb, '["Laminate Flooring","Ceramic Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-DFB5577E';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/91c2a996e6953526cd473f0cff1de839-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/6667009aef71a20667423624ba39a27c-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/61d6cd14b07afa14a2de755e87aec760-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/90e3e2a0af87416a895b547d85804f11-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/72e5502b75b5001ff12fc4259119c3b1-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/db8e56bf31e7aa1d6e3f720773a153e3-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/0426775d5153f851a8baac014baa7bde-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/14018766e6b5a4cfd26e69cb084afe63-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/90f7544a853786b93e93dc9af54d9382-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/999daefa2bd54f829c07e0241fe14a5a-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/90595416a622580de341260a41fc321c-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/c5964f28197a7a4eae13cf675acbf969-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/4c90d8c246cdd0d6878c66396f171ba1-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/832f720dde529d839db612b9975a1995-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/aa5fffec51a79f8402242d9aeb24f388-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/b0ed4513da6fcdc534f27f6aee4e4b54-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/2acd560e00ecf33124b92811b1c8327a-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/de9d4d1b3f8a5f398882f67f834ca4cc-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/a687c704d18990980772355d58cd098f-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/cee1d68a3ecbda6974b95fdbccaf9098-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/59386f2176df50d38e3376a5046853b6-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/74516754467ab238eed789bf6d56daf9-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-DFB5577E', 'https://photos.zillowstatic.com/fp/6278a19e61e154c0c26d06925ecf091a-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-DFB5577E')
ON CONFLICT DO NOTHING;

-- Property 10: 6621 E 19th St #87e337e86
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-0EBE0247', '2 Bed / 1.5 Bath in Tulsa', 'Welcoming you to Cedar Lane in Tulsa, 6621 E 19th St #87e337e86 delivers stylish, comfortable living with custom interior upgrades. The main living room features warm wood-finish flooring and coordinating wood-finish window blinds that invite soft natural light.

The kitchen stands out with distinctive butcher block style countertops, stainless accents, an electric cooking range, refrigerator, and dishwasher.

The upper level houses two quiet bedrooms, complemented by a full bathroom upstairs and a convenient half-bath powder room on the ground level.

Equipped with in-unit laundry hookups and central climate control. Residents enjoy relaxing by the sparkling community swimming pool with convenient access to midtown amenities.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '6621 E 19th St #87e337e86', 'Tulsa', 'OK', '74112', 'Tulsa County', 36.136295, -95.90274,
  'APARTMENT', 2, 1.5, 1, 875, 7000, 1978,
  1000, 1000, 50, 'Off-Street Parking', 0, 'Hookups',
  '["Refrigerator","Electric Range/Oven","Dishwasher"]'::jsonb, '["Butcher Block Style Countertops","Wood-Finish Blinds","Swimming Pool","Guest Half-Bath","Central HVAC"]'::jsonb, '["Wood-Finish Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-0EBE0247';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/d0bbbed97bd5c8344aad7265afeefa49-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/7632ec5468563005cf666a0c0178ce31-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/074c840e95865c2d1479a326be8849a5-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/b3931653f601341028e9a1f1ce070e94-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/f58c98ce2ee473876761607db6c3015e-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/6b0befd13ec8fc3fb8ff7450624cd8ac-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/4c2acfd8dad419a46574c78f4ae1dd51-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/32fc34f5219c20d1c97900b9937f11cd-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/80fd0b60f7cf829a9dc5c065d8682b5e-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/aa11f0b9109da0d22cb5ad7a0958baf9-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/457778ff219b0d1f5d0dabe45d32a4bc-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/a1b2f57eed4f0d0d097cedf4852dbdff-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/6c8c1be9eb3bfb824c7e92b6963e0372-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/99f551caf9c046ae9caa661cc49dd89d-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/3c2898f696753ceec7e2d8aadb787d79-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/e57eb9a47e5321d9709275e93eb3bc27-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/c2d08730a59d3d238be8ce18ea5f5a4f-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/e85937c590ca37954189176355dc390c-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0EBE0247', 'https://photos.zillowstatic.com/fp/0c42d4cd7cd56c4832d0899518c58212-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-0EBE0247')
ON CONFLICT DO NOTHING;

-- Property 11: 4974 S 76th East Ave #47003
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-4B1448F4', '2 Bed / 2 Bath in Tulsa', 'Enjoy the peace of a single-level home with no neighbors above or below you at Park Villas. 4974 S 76th East Ave #47003 offers an expansive layout surrounded by towering mature shade trees.

The generous living and formal dining area opens through sliding glass doors to a large private patio ideal for fresh-air lounging. The kitchen is fully equipped with an oven range, dishwasher, and full refrigeration.

Two large bedrooms include a primary suite with a deep walk-in closet, complemented by two full bathrooms appointed with vanity fixtures and clean tile.

Includes in-unit laundry hookups, central air conditioning, and designated covered parking, providing tranquil living within quick reach of Tulsa conveniences.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '4974 S 76th East Ave #47003', 'Tulsa', 'OK', '74145', 'Tulsa County', 36.091957, -95.89409,
  'APARTMENT', 2, 2, 0, 970, 7400, 1981,
  1000, 1000, 50, 'Covered Parking', 0, 'Hookups',
  '["Range/Oven","Dishwasher","Refrigerator","Microwave"]'::jsonb, '["Single-Level Living (No Overhead Neighbors)","Large Private Dining Patio","Walk-In Master Closet","Mature Shaded Trees","Central HVAC"]'::jsonb, '["Hard Surface Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-4B1448F4';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/af405f80cc14297f070fcedfc5793be3-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/51ce629918726643fe80d0017e410418-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/f893cabb008083298a56dc202c2330df-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/80fe1da7109d071a8840c4ca0daa424d-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/9056572ffb0a5b90c342c1866467128f-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/93d8d008c780e70480c95bc74e5890cc-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/423045c8999c112ffa002b4dec85d883-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/57ba58342527f1247500813468c45e10-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/53b399cdda452d5bcd8fb3d663816333-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/13fe1902a69f32f8b6d5b7e9b9c175e4-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/89043de9188fdc59bc5263f46e79984f-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/1b87db0afb0ccbaef9a97099e137bd09-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/91902677190df088a40a3eecc02058b8-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/37e937882978815ed0f7a61e4ed9bbba-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/935c315b7a8416ef09fed2565a57cf55-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/825eb633b6e673bf882be274035ea1c2-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/8e34bf1d2bdcd8a573095d0c8b24b6ad-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/380f60ccc63e80be6137af39eba71d0f-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/9b0b0cb781fbe8c41f8f38976aaaf862-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/935c4128347309b48f253b26ae551cb5-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/8da0549cf544892a5858662dbc81e766-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/8721025b492bdbab13942071fe4e4533-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/8eea7012415f3d62c6336dde47d213a4-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/66e0b011409e8f99ceb817b3c446f817-uncropped_scaled_within_1536_1152.jpg', 24, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/4eafeda9c581094a6f4a110eed63c3a6-uncropped_scaled_within_1536_1152.jpg', 25, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/8efcea510e114de87590ed23cf247633-uncropped_scaled_within_1536_1152.jpg', 26, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/262dd94b6aefc36a585f21a343fcdc00-uncropped_scaled_within_1536_1152.jpg', 27, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/fc5f699a59784b2e27a381ef6c7252ae-uncropped_scaled_within_1536_1152.jpg', 28, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/5a8c67c3e2dda4db0d71be365cf0dca3-uncropped_scaled_within_1536_1152.jpg', 29, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/2cc9329c63d3f4389b13ec75f154ccb8-uncropped_scaled_within_1536_1152.jpg', 30, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/0ea6b88a2947caa8b16ad194e75849d7-uncropped_scaled_within_1536_1152.jpg', 31, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/2ee60af16563f68f29d1fe043912f8e7-uncropped_scaled_within_1536_1152.jpg', 32, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/a94762862f03a390ed559d9bc72a0676-uncropped_scaled_within_1536_1152.jpg', 33, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/b8c2df32e3c8ef4d20ec7d1a6d0edf0a-uncropped_scaled_within_1536_1152.jpg', 34, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/703f1c2d1abd1b0af5563e166dae146f-uncropped_scaled_within_1536_1152.jpg', 35, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/49ee6503483eca66ae9b252201a52ea6-uncropped_scaled_within_1536_1152.jpg', 36, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/b2d2d5461a127fa540043d583bd08a23-uncropped_scaled_within_1536_1152.jpg', 37, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/b136dcc01e8e460279f608e65f1c5a5a-uncropped_scaled_within_1536_1152.jpg', 38, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/365d491df48d68513f263b678816bc2b-uncropped_scaled_within_1536_1152.jpg', 39, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/3133f329e36cdb9c5110b06b4ab352fe-uncropped_scaled_within_1536_1152.jpg', 40, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/9be26a7feeffa4165e4a2609895ad3f4-uncropped_scaled_within_1536_1152.jpg', 41, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/054bc93689639b69ad560e9c22b75ce5-uncropped_scaled_within_1536_1152.jpg', 42, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/59adeb27169026f98bf6a2ae9fc56ddb-uncropped_scaled_within_1536_1152.jpg', 43, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/8a9eb34ecc926a7c2eed29439d847ad4-uncropped_scaled_within_1536_1152.jpg', 44, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/34db88682e1945a2699234edf38dd5e2-uncropped_scaled_within_1536_1152.jpg', 45, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/5fb4fd2317a15ac63a200202421acc5e-uncropped_scaled_within_1536_1152.jpg', 46, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/8e49b08a104a34a431a7848fac83d6d5-uncropped_scaled_within_1536_1152.jpg', 47, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/c7829271ac76e0387c08e1b73fc6c0b7-uncropped_scaled_within_1536_1152.jpg', 48, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/83b22a89d1575e7952410988d7268b29-uncropped_scaled_within_1536_1152.jpg', 49, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4B1448F4', 'https://photos.zillowstatic.com/fp/2276fba155cd910a48ff6d9d31bd6144-uncropped_scaled_within_1536_1152.jpg', 50, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-4B1448F4')
ON CONFLICT DO NOTHING;

-- Property 12: 6112 S 87th Ave
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-14853A47', '2 Bed / 2 Bath in Tulsa', 'Discover balanced comfort and everyday utility at Silver Springs Apartments. 6112 S 87th Ave delivers expansive living areas and generous closet capacity designed for effortless modern routines.

The well-appointed kitchen features solid countertops, abundant cabinet space, an oven range, dishwasher, and full refrigeration, opening directly into the main living zone.

Two comfortable bedrooms provide ample room for full furnishings, supported by two full bathrooms finished with updated vanities and clean tub-shower enclosures.

Complete with an in-unit washer and dryer and high-efficiency central air conditioning. Located in South Tulsa near premier dining, retail, and recreational hubs.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '6112 S 87th Ave', 'Tulsa', 'OK', '74133', 'Tulsa County', 36.073374, -95.881675,
  'APARTMENT', 2, 2, 0, 990, 7600, 1984,
  1000, 1000, 50, 'Off-Street Parking', 0, 'In Unit',
  '["Refrigerator","Range/Oven","Dishwasher","In-Unit Washer & Dryer"]'::jsonb, '["In-Unit Washer & Dryer Included","Expansive Living Area","Generous Wardrobe Closets","Private Patio","Central HVAC"]'::jsonb, '["Hardwood Laminate","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-14853A47';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/d01e3885260ec4d9ec8bc45a1ef073d9-cc_ft_1536.webp', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/f9d7939ab8eb278569541022a8baf82a-cc_ft_1536.webp', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/2937273d2755dd885e4bb2e2dca04736-cc_ft_1536.webp', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/d589e29997b3d20bbc4284226b18cbd9-cc_ft_1536.webp', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/57c013187bb28d314b3f6e76857b41eb-cc_ft_1536.webp', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/7ee64acadeb2803950dbd7521eacf309-p-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/40cb98f9bf8c7683ddbb680dde83e432-p-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/c2213fc0c7858d71027e84ba85bdf8f5-p-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/8ad0eaf877592c0630f915ed64afadbf-p-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/c4dac89d826a75edd813217d792128d3-p-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/5673dc03dddebe60f0007f057cddc9a9-p-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/207df3a8d9d016df43c2adc7c3a42910-p-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-14853A47', 'https://photos.zillowstatic.com/fp/31569b0a22bf4f88da84a5800aad72fa-p-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-14853A47')
ON CONFLICT DO NOTHING;

-- Property 13: 7643 E 51st St #54860
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-5ECE7B5C', '2 Bed / 2 Bath in Tulsa', 'Situated at Cobblestone Apartments in the heart of Tulsa, 7643 E 51st St #54860 offers a dynamic location with convenient access to Fontana Shopping Center, Woodland Hills Mall, and Regency Park.

The residence opens into an inviting living and dining space finished with easy-care neutral plank flooring and large sunlit windows. The kitchen is fully equipped with quality cabinetry, cooking range, refrigerator, and dishwasher.

Two quiet bedrooms provide dedicated closet space, served by two full bathrooms with clean contemporary vanities and tub surrounds.

Equipped with in-unit washer/dryer connections and central HVAC, situated directly on major public transit and highway thoroughfares.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '7643 E 51st St #54860', 'Tulsa', 'OK', '74145', 'Tulsa County', 36.09057, -95.891624,
  'APARTMENT', 2, 2, 0, 950, 7500, 1984,
  1000, 1000, 50, 'Off-Street Parking', 0, 'Hookups',
  '["Range/Oven","Dishwasher","Refrigerator"]'::jsonb, '["Near Fontana Shopping Center","Close to Woodland Hills Mall","Public Transit Access","Central Heat & Air"]'::jsonb, '["Neutral Plank Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-5ECE7B5C';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/d4a70e0c9d775d34509d594cf649d51e-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/113519999259e599678784e560a3d35f-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/c335285ee52077c8b663d928ed76e091-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/b85d5de44da84f8e386405ed67c422f0-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/6cfbe2d3872f45e6a9ae86511fe41f72-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/0c85007a6400bed1beedea6bf29560dd-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/cdcebe8e0b21fbc016d0027f5087e0c2-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/db588c156c5bd189538d9f913caeca96-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/161b7a9493f3ee636fcd17e09f1de648-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/48f2e03160bed1e1ec770caddfd79cae-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/240cc2eb96f13e76e854ae54db1ac3f3-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/cf3007512c37aa695f7088cdf3c27508-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/a0be8b075f5ef3bc9256d25330c2a38f-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/f23eef5ebea4f392cecae25066190756-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/c9bec8e6e4ab079900c2727732aa4789-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/16479947ece02d9ee57c2e800fcc8c2e-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/fa9085c2ab258a5128e0e5fece9394fc-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/452f34068d0dab3fd516e198680e8f4a-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/f02b7e9645bc23bfe6a53f9a6345e15b-uncropped_scaled_within_1536_1152.jpg', 19, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/e301c0df3dd4e71c19358995f1b609e5-uncropped_scaled_within_1536_1152.jpg', 20, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/afdf2b2e84137a0b573bb084c0fd0ceb-uncropped_scaled_within_1536_1152.jpg', 21, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/307007907e0198eaf9a2345517786fad-uncropped_scaled_within_1536_1152.jpg', 22, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/38412584cd056665c08c4dd48e8d57db-uncropped_scaled_within_1536_1152.jpg', 23, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/9b616d2b6fa839a55b316c50c3a0a1cc-uncropped_scaled_within_1536_1152.jpg', 24, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/3276f472ce54f98600bc445a956eb689-uncropped_scaled_within_1536_1152.jpg', 25, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/45491bcfde322b0473849341f907ee4f-uncropped_scaled_within_1536_1152.jpg', 26, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/fba145b0e103c4d99f51a77d83ee2900-uncropped_scaled_within_1536_1152.jpg', 27, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/5239e059e5a41e6f3f1176daf5d1e142-uncropped_scaled_within_1536_1152.jpg', 28, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/4daddc6226cd7fa7c30d88a65668d61f-uncropped_scaled_within_1536_1152.jpg', 29, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/1a9d38cddd70502fa455688b61deac75-uncropped_scaled_within_1536_1152.jpg', 30, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/a86288fc6abf01d9073de2c7105e531b-uncropped_scaled_within_1536_1152.jpg', 31, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/c912792799da47d125c3f99d35452a1e-uncropped_scaled_within_1536_1152.jpg', 32, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/e4e01c25baa7d8ecb940d829750984ef-uncropped_scaled_within_1536_1152.jpg', 33, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/8d45730d87b8ad6ff2fec3104869b2a5-uncropped_scaled_within_1536_1152.jpg', 34, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/ad305c185574578f495bf8774b4a1929-uncropped_scaled_within_1536_1152.jpg', 35, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/d99156e5e2a147c1e07dcaad19f04a2e-uncropped_scaled_within_1536_1152.jpg', 36, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/9cab2ad88ced8588d89647816c932686-uncropped_scaled_within_1536_1152.jpg', 37, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/2f0d5ddaef5214edf4956c63b8287bff-uncropped_scaled_within_1536_1152.jpg', 38, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/0099ad49ddd8955cb9ac6b5f44a431bd-uncropped_scaled_within_1536_1152.jpg', 39, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/e3e5579eec55eb55b8bd8fdbe1d95415-uncropped_scaled_within_1536_1152.jpg', 40, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/0c9b0cd55602b712f61fd7735fa65a28-uncropped_scaled_within_1536_1152.jpg', 41, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/b911da24fa4504b8de5d55bd6dfd62e3-uncropped_scaled_within_1536_1152.jpg', 42, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/7b6aa6e59b02b1e3cee665ccaec2399c-uncropped_scaled_within_1536_1152.jpg', 43, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/6861e44c52ea7c48019b8c5a63c97598-uncropped_scaled_within_1536_1152.jpg', 44, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/19830c5404eca7df0b974a4449f013cf-uncropped_scaled_within_1536_1152.jpg', 45, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/01fe4ae6b8b8962d3fd26c1db1acff4e-uncropped_scaled_within_1536_1152.jpg', 46, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/8b1643c2c0152cd5b4c74609824d0249-uncropped_scaled_within_1536_1152.jpg', 47, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/2b8c8ade3aaa4d134bb49ccba1e71e5d-uncropped_scaled_within_1536_1152.jpg', 48, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/a48171bd417a613018b4db03ddf838b5-uncropped_scaled_within_1536_1152.jpg', 49, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-5ECE7B5C', 'https://photos.zillowstatic.com/fp/80cefa95af47fb26550524decfbd193a-uncropped_scaled_within_1536_1152.jpg', 50, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-5ECE7B5C')
ON CONFLICT DO NOTHING;

-- Property 14: 2202 E 66th Pl Unit 1902
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-B585A4A1', '2 Bed / 2 Bath in Tulsa', 'Offering an established and peaceful setting in South Midtown Tulsa, 2202 E 66th Pl Unit 1902 presents a practical layout designed to simplify your everyday routine. The welcoming living room features resilient wood-style flooring and broad windows.

The central kitchen provides generous cabinetry, reliable refrigeration, a cooking range, and dishwasher, leading into an open dining nook.

Two private bedrooms offer comfortable dimensions and dedicated storage, complemented by two full bathrooms with modern fixtures.

Features dedicated interior laundry hookups and central climate control, located moments from shopping centers, local dining, and main arterials.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '2202 E 66th Pl Unit 1902', 'Tulsa', 'OK', '74136', 'Tulsa County', 36.066563, -95.95981,
  'APARTMENT', 2, 2, 0, 940, 7200, 1980,
  1000, 1000, 50, 'Off-Street Parking', 0, 'Hookups',
  '["Range/Oven","Dishwasher","Refrigerator"]'::jsonb, '["Established Midtown Corridor","Practical Single-Level Floor Plan","Central Air Conditioning"]'::jsonb, '["Wood-Style Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-B585A4A1';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/04b661b853f6c600865dfd4fd4d0dab7-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/95b98f16e316c726cc48b0d352bcc872-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/05ba047802e523222080a08937daae50-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/323daa2ef6d39378be0f65eec3775890-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/6a977f9652ddd0d16aed224cc2cf994e-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/fd647c5812465149d4b8c97926aa43a3-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/653983d9120c80766d729ee143ea3058-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/4c7d54303c5141c33f0006eb2501976e-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/395ff276a98f4c14142cd29b68300bae-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/62227233a33adaa968b6ee46dbe90e88-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/02019f1a8ede570637e94649a3321963-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/af83dee2482cc2a2bd8ce12a809c7360-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-B585A4A1', 'https://photos.zillowstatic.com/fp/94a882bf30c8a96076639dbbfb6a2e64-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-B585A4A1')
ON CONFLICT DO NOTHING;

-- Property 15: 10872 E 33rd St #10872
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-4A5FA933', '2 Bed / 2 Bath in Tulsa', 'Featuring an attached garage and a private fenced backyard, 10872 E 33rd St #10872 in the Union School District provides house-like convenience. The living room showcases an ambient electric fireplace, ceramic tile flooring, and welcoming natural exposure.

The well-equipped kitchen features solid cabinetry, a cooking range, built-in dishwasher, and full-sized refrigerator, connecting cleanly to the dining area.

The primary bedroom includes a deep walk-in closet, with two full bathrooms providing clean tub-shower combinations and updated vanities.

Includes an attached one-car garage for sheltered parking, a private fenced yard for outdoor enjoyment, interior laundry hookups, and central air conditioning.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '10872 E 33rd St #10872', 'Tulsa', 'OK', '74146', 'Tulsa County', 36.11571, -95.85309,
  'APARTMENT', 2, 2, 0, 1050, 7400, 1985,
  1000, 1000, 50, 'Attached 1-Car Garage + Driveway', 1, 'Hookups',
  '["Stove/Range","Dishwasher","Refrigerator","Electric Fireplace"]'::jsonb, '["Attached 1-Car Garage","Fenced Backyard Lawn","Electric Fireplace Centerpiece","Walk-In Master Closet","Union School District"]'::jsonb, '["Ceramic Tile","Plush Carpeting"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-4A5FA933';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/35986ce285826a3b811cf853cdf4089c-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/eb90d870164d5860790ca11229959001-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/44fb4df40f3bf8bc045591e376724053-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/357e5b083fef48f75727d33e6ffaa33f-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/bfcf5f1008729ac531e3406a445c65f7-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/1aff348b43783dd527123188e6fb74e3-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/46d497acc677f600a9ca04adf2a7730a-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/2df32712f6fa89b6db61c13c3cc8e067-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/f7bccb7b00f66078abc12a793a5f9ab2-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-4A5FA933', 'https://photos.zillowstatic.com/fp/158c707c6373e64e1ebbe259b8130b2b-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-4A5FA933')
ON CONFLICT DO NOTHING;

-- Property 16: 1802 E 66th Pl Unit F209
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-1070C6B6', '2 Bed / 2 Bath in Tulsa', 'Showcasing dramatic architectural character, 1802 E 66th Pl Unit F209 is a striking two-story loft condo residence. The soaring vaulted ceilings in the great room frame an impressive open living area with rich hard-surface flooring.

The kitchen is comprehensively equipped with a refrigerator, cooking stove, and dishwasher, alongside an in-unit washer and dryer.

The upper-level loft primary suite overlooks the great room below, featuring a private full bathroom and walk-in wardrobe, while a second full bathroom and bedroom serve guests on the main level.

Equipped with central heating and air conditioning and dedicated parking in an established South Tulsa corridor.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '1802 E 66th Pl Unit F209', 'Tulsa', 'OK', '74136', 'Tulsa County', 36.067192, -95.96355,
  'TOWNHOUSE', 2, 2, 0, 1120, 7300, 1982,
  1000, 1000, 50, 'Dedicated Off-Street Parking', 0, 'In Unit',
  '["Refrigerator","Stove/Range","Dishwasher","In-Unit Washer & Dryer"]'::jsonb, '["Dramatic 2-Story Loft Architecture","Master Bedroom Overlooking Living Room","Vaulted Ceilings","Central HVAC"]'::jsonb, '["Hard Surface Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-1070C6B6';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/a721951cc4ea1ed34d5728d3ff8ff9d5-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/91068e21e09c02e67b3174c838f6a771-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/cc6711038cb7f856dcad9e2d1f81daf5-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/1627b6807bad0b5c8a0e1a644f86d5e0-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/886fb44a83bfd0befb31f2f5d80aa4b0-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/a9b08c5a31223f49a5e58b3907812595-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/caecbf4f531e2ef8640c3023a642fb62-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/ab62f5493abeecedd1c65a43fc7a157c-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/b9e179486bc4127357aa0dd2cb321345-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/cfe2a83d52185ed9b3e76a8b53933b61-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1070C6B6', 'https://photos.zillowstatic.com/fp/f15f32a2a71376d27130f2074145623a-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-1070C6B6')
ON CONFLICT DO NOTHING;

-- Property 17: 2413 E 59th Ct Unit 2
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-1D2FB1A2', '2 Bed / 1.5 Bath in Tulsa', 'Situated in a quiet, prestigious neighborhood just off 59th and Lewis Avenue near Southern Hills Golf Course and River Parks, 2413 E 59th Ct Unit 2 is an attractive two-story townhome. The ground level features a sunlit living room with durable hardwood-style vinyl flooring.

The kitchen is equipped with solid cabinetry, full refrigeration, an electric stove, and dishwasher, connecting directly to the dining area.

Upstairs, two comfortable bedrooms offer deep closet space and share a full central bathroom, while a half-bath powder room serves visitors downstairs.

Features in-unit laundry hookups, central air conditioning, covered carport parking, and included exterior lawn maintenance, with swift connectivity to I-44.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '2413 E 59th Ct Unit 2', 'Tulsa', 'OK', '74105', 'Tulsa County', 36.078, -95.95607,
  'TOWNHOUSE', 2, 1.5, 1, 1010, 7500, 1979,
  1000, 1000, 50, 'Covered Carport', 0, 'Hookups',
  '["Refrigerator","Electric Stove/Range","Dishwasher"]'::jsonb, '["Two-Story Townhouse Layout","Near Southern Hills Golf Course & River Parks","Guest Half-Bath","Central HVAC"]'::jsonb, '["Hardwood-Style Vinyl","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-1D2FB1A2';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/5119dbf8b93f703c3c0461a82c5cb02f-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/73595b6000bec25123e15c5f4b1a2f70-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/e9457e372e83d3547a027b1c7ea8d51a-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/4f0dc678bda75cfcdd21b0d28f54042b-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/836d58688cedb1929d0c18f3ae9c3454-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/9817943eb989091ec3a075c7a2927c94-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/47e032e7ad5cf7ba94ac1afc2d2d4db9-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/e2988d6810e0b0caca45d81c78a2275d-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/78be56726225bf01572a9b196d87a1b2-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/1ea047269152bea5bf23a88066dd715f-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-1D2FB1A2', 'https://photos.zillowstatic.com/fp/ed9684853f204839e0bcb2362583074c-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-1D2FB1A2')
ON CONFLICT DO NOTHING;

-- Property 18: 3220 E 47th St S
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-36ED7048', '2 Bed / 1.5 Bath in Tulsa', 'Nestled in a prime Midtown Tulsa location just off Harvard Avenue, 3220 E 47th St S is an appealing two-bedroom duplex residence. The welcoming living room highlights a handsome brick fireplace centerpiece and polished hardwood flooring.

The sunny dining area sits adjacent to the fully equipped kitchen, which includes an oven range, dishwasher, and refrigerator.

Sliding glass doors lead out from the primary bedroom to a private, fully fenced backyard and patio, complemented by 1.5 bathrooms with clean fixtures.

Includes a reserved carport with a dedicated lockable exterior storage closet right at your front door, in-unit laundry amenities, and central HVAC, moments from I-44 and Yale Avenue.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '3220 E 47th St S', 'Tulsa', 'OK', '74105', 'Tulsa County', 36.09525, -95.941696,
  'DUPLEX', 2, 1.5, 1, 1117, 7800, 1976,
  1000, 1000, 50, 'Reserved Carport + Storage Closet', 0, 'In Unit',
  '["Stove/Range","Dishwasher","Refrigerator","Washer & Dryer Option"]'::jsonb, '["Attached Carport with Storage Closet","Sliding Glass Door to Fenced Yard & Patio","Wood-Burning Fireplace","Midtown Tulsa Location off Harvard","Central HVAC"]'::jsonb, '["Hardwood Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-36ED7048';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/c47f975a5e6cd217c2e3fc481195f259-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/fdc8a58a4a6458fe9da551b1f2eb70a2-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/a8d6dd3ac24c1699b826acbfc024f031-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/5eb74fd8775e9bde332f6aaaefd224f3-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/13549008ae19e8f32a38602a0c33b484-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/7aaf34565de3083af6fce6a99d1f5bde-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/76cc73445ff1f192489ec39782c5ae5c-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/afe1c097041baf3dd8f21c1df50e2578-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/320ef6136cd646da12ea772decf4ca3a-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/a8378053abc50ec985c51e98d530e80a-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/c375d8e57d405269b5737bdebe1b4303-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/1541f96ee51c1213096c735b6a9d992a-uncropped_scaled_within_1536_1152.jpg', 12, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/b2fb36ae45cf1372ad3b9432b45ed401-uncropped_scaled_within_1536_1152.jpg', 13, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/fbc82d059af85d02a88f6569645e604d-uncropped_scaled_within_1536_1152.jpg', 14, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/4d40e57cd464afc81e91782459a436ed-uncropped_scaled_within_1536_1152.jpg', 15, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/34a38ea8432a6131a57ee4789b655007-uncropped_scaled_within_1536_1152.jpg', 16, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/e3a8f22633a7e055655258dce6111f1f-uncropped_scaled_within_1536_1152.jpg', 17, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-36ED7048', 'https://photos.zillowstatic.com/fp/e6d75edce34b1456e1dfa744d23e3833-uncropped_scaled_within_1536_1152.jpg', 18, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-36ED7048')
ON CONFLICT DO NOTHING;

-- Property 19: 2324 W Newton St
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-C37C7C19', '2 Bed / 2 Bath in Tulsa', 'Set in the tranquil enclave of Oak Creek at Gilcrease northwest of downtown, 2324 W Newton St provides 1,286 square feet of stylish two-story townhome living. The front entry leads into an expansive great room with wood-style flooring and abundant window light.

The kitchen features modern cabinetry, solid prep surfaces, a cooking range, built-in dishwasher, and full refrigeration, flowing toward the dining area and rear patio door.

Two spacious bedrooms feature private closet capacity, supported by two full contemporary bathrooms.

Includes an attached one-car garage, private covered outdoor patio, interior laundry connections, and central air conditioning. Located minutes from the Gilcrease Museum, Arkansas River trails, and the BOK Center.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '2324 W Newton St', 'Tulsa', 'OK', '74127', 'Tulsa County', 36.172855, -96.017845,
  'TOWNHOUSE', 2, 2, 0, 1286, 8200, 1988,
  1000, 1000, 50, 'Attached 1-Car Garage & Driveway', 1, 'Hookups',
  '["Range/Oven","Dishwasher","Refrigerator","Microwave"]'::jsonb, '["Attached 1-Car Garage","Private Covered Patio","Minutes to Downtown Tulsa, Arkansas River & BOK Center","Scenic Oak Creek at Gilcrease Enclave","Central HVAC"]'::jsonb, '["Wood-Style Flooring","Ceramic Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-C37C7C19';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/cd3d5a6ff891633b000d295caf9c3f2d-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/c4e0eecd4e52fa1c3f97d7c3dbce93f9-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/702a70a5498dc48cf7a97c35cd4ba9b7-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/e27c105cc6e4e5809174226fcd541adc-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/9d025f3f081496522c08b13d38c82625-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/f2445c1ba7b9fe6ac8e1c84531fe34a3-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/2521d9f4c9eb6ee63d3ac3872d438530-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/647fddb007652ffaa86015a00353a428-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/8a8184f5f8946fa43c9b5e897df6b17d-uncropped_scaled_within_1536_1152.jpg', 9, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/4b4783936d010e9d6eac8b83813cf4f7-uncropped_scaled_within_1536_1152.jpg', 10, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-C37C7C19', 'https://photos.zillowstatic.com/fp/bf86248b42841943ab5bd0f8af0cbf95-uncropped_scaled_within_1536_1152.jpg', 11, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-C37C7C19')
ON CONFLICT DO NOTHING;

-- Property 20: 4666 E 68th St Unit 293
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-44E03A0A', '2 Bed / 2 Bath in Tulsa', 'Delivering hassle-free rental living in South Tulsa, 4666 E 68th St Unit 293 provides a clean, well-proportioned layout complete with an in-unit washer and dryer. The primary living room is bright and welcoming, finished with low-maintenance hard-surface flooring.

The kitchen is equipped with solid cabinet space, an oven range, dishwasher, and refrigerator, opening directly to the central dining space.

Two private bedrooms offer closet storage, paired with two full bathrooms with modern vanities and full tub-shower surrounds.

Complete with high-efficiency central air conditioning and off-street parking, conveniently situated near shopping and dining corridors.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '4666 E 68th St Unit 293', 'Tulsa', 'OK', '74136', 'Tulsa County', 36.06575, -95.923935,
  'APARTMENT', 2, 2, 0, 831, 7000, 1980,
  1000, 1000, 50, 'Off-Street Parking', 0, 'In Unit',
  '["Stove/Range","Refrigerator","Dishwasher","In-Unit Washer & Dryer"]'::jsonb, '["In-Unit Washer & Dryer Included","Open Living Concept","South Tulsa Location","Central HVAC"]'::jsonb, '["Hard Surface Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-44E03A0A';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-44E03A0A', 'https://photos.zillowstatic.com/fp/e066cd49c37c623b78a07cc5811e8a29-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-44E03A0A', 'https://photos.zillowstatic.com/fp/cb657055add6da0804410cb758e9d2c8-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-44E03A0A', 'https://photos.zillowstatic.com/fp/6068144a818bb3af9113f699577e48a0-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-44E03A0A', 'https://photos.zillowstatic.com/fp/5d183304a9ec7d4e07455cd61ffb4529-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-44E03A0A', 'https://photos.zillowstatic.com/fp/95e934b2c165d2c966b36dc00aa0a3aa-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-44E03A0A', 'https://photos.zillowstatic.com/fp/1f0bfc20df0f25e11c44c8eabcae10e9-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-44E03A0A', 'https://photos.zillowstatic.com/fp/b1e9cb1293b2bfd962bf951218c441fe-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-44E03A0A', 'https://photos.zillowstatic.com/fp/abaffbfb8d08c578f071f9ee6721692c-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-44E03A0A')
ON CONFLICT DO NOTHING;

-- Property 21: 4666 E 68th St
INSERT INTO public.properties (
  id, title, description, address, city, state, zip, county, lat, lng,
  property_type, bedrooms, bathrooms, half_bathrooms, square_footage, lot_size_sqft, year_built,
  monthly_rent, security_deposit, application_fee, parking, garage_spaces, laundry_type,
  appliances, amenities, flooring, pets_allowed, smoking_allowed, status, created_at, updated_at
) VALUES (
  'PP-0E31D93A', '2 Bed / 2 Bath in Tulsa', 'Providing comfort and everyday convenience in South Tulsa, 4666 E 68th St offers an efficient two-bedroom townhouse residence with an included in-unit washer and dryer. The central living room offers plenty of natural daylight and resilient hard-surface floors.

The kitchen is equipped with a cooking stove, refrigerator, and dishwasher, leading naturally into the dining area.

Both bedrooms provide peaceful, private accommodations with dedicated closet capacity, served by two clean full bathrooms.

Equipped with central heating and air conditioning and off-street parking, located close to regional thoroughfares and retail centers.

Pet-Friendly. Application Fee: $50. Submit your rental application today at Choice Properties.', '4666 E 68th St', 'Tulsa', 'OK', '74136', 'Tulsa County', 36.06565, -95.92377,
  'TOWNHOUSE', 2, 2, 0, 831, 7000, 1980,
  1000, 1000, 50, 'Off-Street Parking', 0, 'In Unit',
  '["Stove/Range","Refrigerator","Dishwasher","In-Unit Washer & Dryer"]'::jsonb, '["In-Unit Washer & Dryer Included","Spacious Bedrooms","South Tulsa Neighborhood","Central Air Conditioning"]'::jsonb, '["Hard Surface Flooring","Tile"]'::jsonb, true, false, 'private_placement', NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  monthly_rent = EXCLUDED.monthly_rent, security_deposit = EXCLUDED.security_deposit, status = 'private_placement', description = EXCLUDED.description;

DELETE FROM public.property_photos WHERE property_id = 'PP-0E31D93A';
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0E31D93A', 'https://photos.zillowstatic.com/fp/792a2e56290b94c7b3eb752687fd4fa7-uncropped_scaled_within_1536_1152.jpg', 1, true, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0E31D93A', 'https://photos.zillowstatic.com/fp/f0751643e0178c3a399dda4932b13222-uncropped_scaled_within_1536_1152.jpg', 2, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0E31D93A', 'https://photos.zillowstatic.com/fp/ed936488c9dfd95fa6d69447a4689515-uncropped_scaled_within_1536_1152.jpg', 3, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0E31D93A', 'https://photos.zillowstatic.com/fp/89c42984ff487ba540a2e0cfbd614e59-uncropped_scaled_within_1536_1152.jpg', 4, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0E31D93A', 'https://photos.zillowstatic.com/fp/8e97a8694e323ef5a9046c0b70057d8a-uncropped_scaled_within_1536_1152.jpg', 5, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0E31D93A', 'https://photos.zillowstatic.com/fp/e10967e641103273c1e67acff63b97b6-uncropped_scaled_within_1536_1152.jpg', 6, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0E31D93A', 'https://photos.zillowstatic.com/fp/367df9dc73714534a4fc319b22ba8dea-uncropped_scaled_within_1536_1152.jpg', 7, false, NOW());
INSERT INTO public.property_photos (id, property_id, url, display_order, is_hero, created_at)
VALUES (gen_random_uuid(), 'PP-0E31D93A', 'https://photos.zillowstatic.com/fp/b384c10c643d7c525c4f7096549e5432-uncropped_scaled_within_1536_1152.jpg', 8, false, NOW());

INSERT INTO public.property_share_properties (share_id, property_id)
VALUES ('ff1c91e2-be88-4e2c-a946-a74f0ef1740c', 'PP-0E31D93A')
ON CONFLICT DO NOTHING;

COMMIT;
