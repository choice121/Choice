import re

content = open("scraper/pipeline.py").read()

new_method = """    def _step11_publish(self, pipeline_id: str) -> Tuple[Optional[str], Optional[str]]:
        \"\"\"Bypass pipeline_publish RPC due to Postgres date casting bug. Inserts directly via REST.\"\"\"
        if not self._pub_session:
            return None, "No HTTP session"
            
        try:
            # 1. Fetch pipeline record
            import urllib.parse, uuid, re, json
            from datetime import datetime, timezone
            
            r_get = self._pipe_session.get(
                "{}/rest/v1/pipeline_properties?id=eq.{}&select=*".format(
                    SUPABASE_URL, urllib.parse.quote(pipeline_id)
                ),
                timeout=20
            )
            r_get.raise_for_status()
            rows = r_get.json()
            if not rows:
                return None, "Listing not found in pipeline"
            p = rows[0]
            
            # 2. Get landlord id
            landlord_id = p.get('poster_landlord_id')
            if not landlord_id:
                try:
                    r_ll = self._pub_session.get(
                        "{}/rest/v1/landlords?select=id&limit=1".format(SUPABASE_URL),
                        timeout=20
                    )
                    if r_ll.ok and r_ll.json():
                        landlord_id = r_ll.json()[0]['id']
                except:
                    pass
                    
            # 3. Payload
            new_id = str(uuid.uuid4())
            
            amens = p.get('amenities')
            if amens and amens != '' and amens != '[]':
                try:
                    amens_list = json.loads(amens) if isinstance(amens, str) else amens
                except:
                    amens_list = None
            else:
                amens_list = None
                
            avail = p.get('available_date')
            if avail and isinstance(avail, str) and re.match(r'^\\d{4}-\\d{2}-\\d{2}$', avail):
                avail_parsed = avail
            else:
                avail_parsed = None
                
            insert_payload = {
                'id': new_id,
                'landlord_id': landlord_id,
                'status': 'draft',
                'title': p.get('title'),
                'description': p.get('description'),
                'showing_instructions': p.get('showing_instructions'),
                'address': p.get('address'),
                'city': p.get('city'),
                'state': p.get('state'),
                'zip': p.get('zip'),
                'county': p.get('county'),
                'neighborhood': p.get('neighborhood'),
                'lat': p.get('lat'),
                'lng': p.get('lng'),
                'property_type': p.get('property_type'),
                'year_built': p.get('year_built'),
                'floors': p.get('floors'),
                'unit_number': p.get('unit_number'),
                'total_units': p.get('total_units'),
                'bedrooms': p.get('bedrooms'),
                'bathrooms': p.get('bathrooms'),
                'half_bathrooms': p.get('half_bathrooms'),
                'square_footage': p.get('square_footage'),
                'lot_size_sqft': p.get('lot_size_sqft'),
                'garage_spaces': p.get('garage_spaces'),
                'monthly_rent': p.get('monthly_rent'),
                'security_deposit': p.get('security_deposit'),
                'last_months_rent': p.get('last_months_rent'),
                'application_fee': 50,
                'pet_deposit': p.get('pet_deposit'),
                'admin_fee': p.get('admin_fee'),
                'move_in_special': p.get('move_in_special'),
                'available_date': avail_parsed,
                'minimum_lease_months': p.get('minimum_lease_months'),
                'pets_allowed': p.get('pets_allowed'),
                'pet_details': p.get('pet_details'),
                'pet_weight_limit': p.get('pet_weight_limit'),
                'smoking_allowed': p.get('smoking_allowed'),
                'parking': p.get('parking'),
                'amenities': amens_list,
                'location_context': p.get('location_context'),
                'virtual_tour_url': p.get('virtual_tour_url'),
                'has_basement': p.get('has_basement'),
                'has_central_air': p.get('has_central_air'),
                'listed_at': p.get('listed_at'),
                'source_status': p.get('source_status') or 'available'
            }
            
            # 4. Insert
            r_in = self._pub_session.post(
                "{}/rest/v1/properties".format(SUPABASE_URL),
                json=insert_payload,
                timeout=30,
                headers={"Prefer": "return=minimal"}
            )
            if not r_in.ok:
                return None, "Insert failed: {}".format(r_in.text[:200])
                
            # 5. Update pipeline
            if self._pipe_session:
                now_str = datetime.now(timezone.utc).isoformat()
                update_payload = {
                    'status': 'published',
                    'choice_property_id': new_id,
                    'published_at': now_str,
                    'updated_at': now_str
                }
                r_up = self._pipe_session.patch(
                    "{}/rest/v1/pipeline_properties?id=eq.{}".format(SUPABASE_URL, urllib.parse.quote(pipeline_id)),
                    json=update_payload,
                    timeout=30
                )
            
            return new_id, None
        except Exception as e:
            return None, str(e)[:200]
"""

pattern = re.compile(r'    def _step11_publish.*?        except Exception as e:.*?return None, str\(e\)', re.DOTALL)
if pattern.search(content):
    content = pattern.sub(lambda m: new_method, content)
    with open("scraper/pipeline.py", "w") as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Could not find _step11_publish")
