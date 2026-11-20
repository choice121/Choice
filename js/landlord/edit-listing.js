// js/landlord/edit-listing.js
  // Extracted from landlord/edit-listing.html (issue #27). Loaded as <script type="module">.
  // Single-page edit form: load existing, photo add/remove, save changes.
  // Imports use absolute /js/... paths because the file lives in /js/landlord/.

    import { requireAuth, getLandlordProfile, signOut, supabase } from '/js/cp-api.js';
  import { uploadMultipleToImageKit, deleteFromImageKit } from '/js/imagekit.js';
  import { STATES, whenSidebarReady, installImageFallback } from '/js/landlord/shared.js';

  installImageFallback();

  const _params  = new URLSearchParams(window.location.search);
  const _isAdmin = _params.get('admin') === '1';

  if (_isAdmin) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/admin/login.html'; throw new Error(); }
    const { data: adminRole } = await supabase.from('admin_roles').select('id').eq('user_id', user.id).maybeSingle();
    if (!adminRole) { window.location.href = '/admin/login.html'; throw new Error(); }
  } else {
    await requireAuth('/landlord/login.html');
  }

  const profile = await getLandlordProfile();
  if (!profile && !_isAdmin) { window.location.href = '/landlord/login.html'; throw new Error(); }

  // Wire chrome's sign-out (delegated)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="sign-out"]');
    if (btn) {
      e.preventDefault();
      supabase.auth.signOut().then(() => {
        window.location.href = _isAdmin ? '/admin/login.html' : '/landlord/login.html';
      });
    }
  });

  // Sidebar info via chrome
  whenSidebarReady(() => {
    const nameEl = document.getElementById('admin-name');
    if (nameEl) {
      if (profile) {
        const display = profile.business_name || profile.contact_name || '';
        nameEl.textContent = display + (profile.email ? ' · ' + profile.email : '');
      } else if (_isAdmin) {
        nameEl.textContent = 'Admin · (admin session)';
      }
    }
  });

  const propertyId = _params.get('id');
  const backURL    = _isAdmin ? '/admin/listings.html' : '/landlord/dashboard.html';
  if (!propertyId) { window.location.href = backURL; throw new Error(); }

  const { data: prop, error } = await supabase
    .from('properties').select('*, property_photos(id, url, file_id, display_order)').eq('id', propertyId).single();

  // Phase 3c: derive legacy photo_urls / photo_file_ids from the embedded property_photos.
  let currentPhotos = [];
  if (prop) {
    const _photos = Array.isArray(prop.property_photos) ? prop.property_photos.slice() : [];
    _photos.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    currentPhotos = _photos.filter(x => x && x.url).map((x, idx) => ({
      id: x.id || null,
      url: x.url,
      file_id: x.file_id ?? null,
      display_order: x.display_order ?? idx,
    }));
    prop.photo_urls     = currentPhotos.map(x => x.url);
    prop.photo_file_ids = currentPhotos.map(x => x.file_id ?? null);
  }

  if (error || !prop) {
    CP.UI.toast('Property not found or access denied.', 'error');
    setTimeout(() => window.location.href = backURL, 2000);
    throw new Error();
  }

  document.getElementById('pageTitle').textContent = prop.title;
  document.getElementById('viewPropBtn').href      = `/property.html?id=${propertyId}`;

  // Photo state
  let currentPhotoUrls    = [...(prop.photo_urls    || [])];
  let currentPhotoFileIds = [...(prop.photo_file_ids || [])];
  let originalPhotoFileIds = [...currentPhotoFileIds];
  let pendingNewFiles     = [];
  let pendingNewPreviews  = [];

  const chk = (arr, val) => arr && arr.includes(val) ? 'checked' : '';
  const sel = (opt, val) => opt == val ? 'selected' : '';
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // STATES imported from shared.js

  document.getElementById('formCard').innerHTML = `
    <div class="form-section">

      <div class="form-section-title">Basic Information</div>
      <div class="form-group">
        <label class="form-label" for="title">Listing Title *</label>
        <input type="text" class="form-input" id="title" value="${esc(prop.title)}">
      </div>
      <div class="form-group">
        <label class="form-label" for="propertyType">Property Type *</label>
        <select class="form-select" id="propertyType">
          <option value="apartment" ${sel(prop.property_type,'apartment')}>Apartment</option>
          <option value="house"     ${sel(prop.property_type,'house')}>House</option>
          <option value="condo"     ${sel(prop.property_type,'condo')}>Condo</option>
          <option value="townhouse" ${sel(prop.property_type,'townhouse')}>Townhouse</option>
          <option value="duplex"    ${sel(prop.property_type,'duplex')}>Duplex</option>
          <option value="studio"    ${sel(prop.property_type,'studio')}>Studio</option>
          <option value="basement"  ${sel(prop.property_type,'basement')}>Basement Unit</option>
        </select>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="address">Street Address *</label>
          <input type="text" class="form-input" id="address" value="${esc(prop.address)}">
        </div>
        <div class="form-group">
          <label class="form-label" for="unitNumber">Unit / Apt #</label>
          <input type="text" class="form-input" id="unitNumber" value="${esc(prop.unit_number||'')}" placeholder="e.g. Apt 4B">
        </div>
      </div>
      <div class="form-grid-3">
        <div class="form-group"><label class="form-label" for="city">City *</label><input type="text" class="form-input" id="city" value="${esc(prop.city)}"></div>
        <div class="form-group">
          <label class="form-label" for="state">State *</label>
          <select class="form-select" id="state" required>
            <option value="">Select State</option>
            ${STATES.map(([c,n]) => `<option value="${c}" ${sel(prop.state,c)}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label" for="zip">ZIP</label><input type="text" class="form-input" id="zip" value="${esc(prop.zip||'')}"></div>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label" for="county">County</label><input type="text" class="form-input" id="county" value="${esc(prop.county||'')}"></div>
        <div class="form-group"><label class="form-label" for="neighborhood">Neighborhood</label><input type="text" class="form-input" id="neighborhood" value="${esc(prop.neighborhood||'')}"></div>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:var(--sp-5) 0">
      <div class="form-section-title">Details &amp; Pricing</div>
      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label" for="bedrooms">Bedrooms *</label>
          <select class="form-select" id="bedrooms">
            <option value="0" ${sel(prop.bedrooms,0)}>Studio</option>
            <option value="1" ${sel(prop.bedrooms,1)}>1</option>
            <option value="2" ${sel(prop.bedrooms,2)}>2</option>
            <option value="3" ${sel(prop.bedrooms,3)}>3</option>
            <option value="4" ${sel(prop.bedrooms,4)}>4</option>
            <option value="5" ${sel(prop.bedrooms,5)}>5+</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="bathrooms">Bathrooms *</label>
          <select class="form-select" id="bathrooms">
            <option value="1"   ${sel(prop.bathrooms,1)}>1</option>
            <option value="1.5" ${sel(prop.bathrooms,1.5)}>1.5</option>
            <option value="2"   ${sel(prop.bathrooms,2)}>2</option>
            <option value="2.5" ${sel(prop.bathrooms,2.5)}>2.5</option>
            <option value="3"   ${sel(prop.bathrooms,3)}>3+</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label" for="sqft">Sq. Footage</label><input type="number" class="form-input" id="sqft" value="${prop.square_footage||''}"></div>
      </div>
      <div class="form-grid-3">
        <div class="form-group"><label class="form-label" for="halfBathrooms">Half Baths</label><input type="number" class="form-input" id="halfBathrooms" value="${prop.half_bathrooms??''}" min="0"></div>
        <div class="form-group"><label class="form-label" for="lotSizeSqft">Lot Size (sqft)</label><input type="number" class="form-input" id="lotSizeSqft" value="${prop.lot_size_sqft||''}" min="0"></div>
        <div class="form-group"><label class="form-label" for="floors">Floors</label><input type="number" class="form-input" id="floors" value="${prop.floors||''}" min="1"></div>
      </div>
      <div class="form-group"><label class="form-label" for="yearBuilt">Year Built</label><input type="number" class="form-input" id="yearBuilt" value="${prop.year_built||''}" min="1800" max="2030"></div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="rent">Monthly Rent *</label>
          <div style="position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">$</span><input type="number" class="form-input" id="rent" value="${prop.monthly_rent}" style="padding-left:28px"></div>
        </div>
        <div class="form-group">
          <label class="form-label" for="deposit">Security Deposit</label>
          <div style="position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">$</span><input type="number" class="form-input" id="deposit" value="${prop.security_deposit||''}" style="padding-left:28px"></div>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group"><label class="form-label" for="availDate">Available Date</label><input type="date" class="form-input" id="availDate" value="${prop.available_date||''}"></div>
        <div class="form-group">
          <label class="form-label" for="appFee">Application Fee</label>
          <div style="position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">$</span><input type="number" class="form-input" id="appFee" value="${prop.application_fee ?? 50}" style="padding-left:28px" min="0" placeholder="50"></div>
          <div class="form-hint">Standard application fee is $50.</div>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="lastMonthRent">Last Month's Rent</label>
          <div style="position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">$</span><input type="number" class="form-input" id="lastMonthRent" value="${prop.last_months_rent||''}" style="padding-left:28px" min="0" placeholder="0"></div>
          <div class="form-hint">Enter 0 if not required.</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="adminFee">Admin / Move-in Fee</label>
          <div style="position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">$</span><input type="number" class="form-input" id="adminFee" value="${prop.admin_fee||''}" style="padding-left:28px" min="0" placeholder="0"></div>
          <div class="form-hint">One-time fee at move-in. Enter 0 if none.</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="moveInSpecial">Move-in Special <span class="muted">(optional)</span></label>
        <input type="text" class="form-input" id="moveInSpecial" value="${esc(prop.move_in_special||'')}" placeholder="e.g. First month free, Reduced deposit" maxlength="200">
        <div class="form-hint">Highlight any current promotions.</div>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="minIncome">Income Requirement <span class="muted">(optional)</span></label>
          <select class="form-select" id="minIncome">
            <option value="">No minimum</option>
            ${[['2','2× monthly rent'],['2.5','2.5× monthly rent'],['3','3× monthly rent'],['3.5','3.5× monthly rent'],['4','4× monthly rent']].map(([vv,l])=>`<option value="${vv}" ${prop.minimum_income_multiplier==vv?'selected':''}>${l}</option>`).join('')}
          </select>
          <div class="form-hint">Standard is 2.5–3×.</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="minCredit">Min. Credit Score <span class="muted">(optional)</span></label>
          <select class="form-select" id="minCredit">
            <option value="">No minimum</option>
            ${[580,620,640,660,680,700,720,750].map(s=>`<option value="${s}" ${prop.minimum_credit_score==s?'selected':''}>${s}</option>`).join('')}
          </select>
          <div class="form-hint">Helps applicants self-screen.</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="status">Listing Status</label>
        <select class="form-select" id="status">
          ${prop.status === 'draft' ? `<option value="draft" selected>Draft — not yet submitted</option>` : ''}
          <option value="active" ${sel(prop.status,'active')}>Active — visible to renters</option>
          <option value="paused" ${sel(prop.status,'paused')}>Paused — hidden from search</option>
          <option value="rented" ${sel(prop.status,'rented')}>Rented — unit is occupied</option>
        </select>
        <div class="form-hint">${prop.status === 'draft' ? 'Change to "Active" to publish this listing.' : 'Set to "Paused" to hide from search, or "Rented" once leased.'}</div>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:var(--sp-5) 0">
      <div class="form-section-title">Features &amp; Policies</div>

      <div class="form-group">
        <label class="form-label">Pets</label>
        <div style="display:flex;gap:var(--sp-2)">
          <label class="checkbox-pill" style="flex:1;justify-content:center"><input type="radio" name="pets" value="true" ${prop.pets_allowed?'checked':''}> Pets Allowed</label>
          <label class="checkbox-pill" style="flex:1;justify-content:center"><input type="radio" name="pets" value="false" ${!prop.pets_allowed?'checked':''}> No Pets</label>
        </div>
        <div id="petDetailsWrap" style="${prop.pets_allowed?'':'display:none'};margin-top:var(--sp-3)">
          <div class="form-group">
            <label class="form-label" style="font-size:.78rem">Pet Types Allowed</label>
            <div class="checkbox-group" id="petTypesGroup">
              ${['Dogs','Cats','Birds','Small Animals','Reptiles'].map(t=>`<label class="checkbox-pill"><input type="checkbox" name="petTypes" value="${t}" ${chk(prop.pet_types_allowed,t)}> ${t}</label>`).join('')}
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label" style="font-size:.78rem">Dog Weight Limit</label>
              <select class="form-select" id="petWeightLimit">
                <option value="">No limit</option>
                ${[15,25,50,75,100].map(w=>`<option value="${w}" ${prop.pet_weight_limit==w?'selected':''}>Under ${w} lbs</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-size:.78rem">Pet Deposit</label>
              <div style="position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">$</span><input type="number" class="form-input" id="petDeposit" value="${prop.pet_deposit||''}" style="padding-left:28px" min="0" placeholder="0"></div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:.78rem">Additional Pet Notes</label>
            <input type="text" class="form-input" id="petDetails" value="${esc(prop.pet_details||'')}" placeholder="e.g. Max 2 pets, breed restrictions apply">
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="parking">Parking Type</label>
        <select class="form-select" id="parking">
          <option value="">Select parking type</option>
          ${['None','Street','Driveway','Parking lot','Covered','Garage','Detached Garage','Gated'].map(p=>`<option value="${p}" ${sel(prop.parking,p)}>${p === 'None' ? 'No Parking Available' : p === 'Street' ? 'Street Parking Only' : p === 'Garage' ? 'Garage (Attached)' : p === 'Detached Garage' ? 'Garage (Detached)' : p === 'Parking lot' ? 'Parking Lot' : p}</option>`).join('')}
        </select>
      </div>

      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label" for="garageSpaces">Spaces Included</label>
          <select class="form-select" id="garageSpaces">
            <option value="">Select</option>
            ${[0,1,2,3,4].map(n=>`<option value="${n}" ${prop.garage_spaces==n?'selected':''}>${n === 4 ? '4+ spaces' : n === 0 ? '0 (none)' : n + ' space' + (n>1?'s':'')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="parkingFee">Monthly Parking Fee</label>
          <div style="position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--muted)">$</span><input type="number" class="form-input" id="parkingFee" value="${prop.parking_fee||''}" style="padding-left:28px" min="0" placeholder="0"></div>
          <div class="form-hint">Enter 0 if included in rent.</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="evCharging">EV Charging</label>
          <select class="form-select" id="evCharging">
            <option value="none" ${!prop.ev_charging||prop.ev_charging==='none'?'selected':''}>Not Available</option>
            <option value="available" ${prop.ev_charging==='available'?'selected':''}>Available (Level 1/2)</option>
            <option value="included" ${prop.ev_charging==='included'?'selected':''}>Included in Rent</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Utilities Included</label>
        <div class="checkbox-group">
          ${['Water','Gas','Electric','Trash','Internet','Heat'].map(u=>`<label class="checkbox-pill"><input type="checkbox" name="utilities" value="${u}" ${chk(prop.utilities_included,u)}> ${u}</label>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Amenities</label>
        <div class="checkbox-group">
          ${['Washer/Dryer','Dishwasher','Central A/C','Hardwood Floors','Balcony/Patio','Basement','Pool','Gym','Fireplace','Stainless Appliances','Granite Counters','Smart Home'].map(a=>`<label class="checkbox-pill"><input type="checkbox" name="amenities" value="${a}" ${chk(prop.amenities,a)}> ${a}</label>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Appliances</label>
        <div class="checkbox-group">
          ${['Refrigerator','Range / Oven','Microwave','Dishwasher','Disposal','Washer','Dryer'].map(a=>`<label class="checkbox-pill"><input type="checkbox" name="appliances" value="${a}" ${chk(prop.appliances,a)}> ${a}</label>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Flooring</label>
        <div class="checkbox-group">
          ${['Hardwood','Laminate','Tile','Carpet','Vinyl','Concrete'].map(f=>`<label class="checkbox-pill"><input type="checkbox" name="flooring" value="${f}" ${chk(prop.flooring,f)}> ${f}</label>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Lease Terms</label>
        <div class="checkbox-group">
          ${['Month-to-month','6 months','12 months','24 months'].map(t=>`<label class="checkbox-pill"><input type="checkbox" name="leaseTerms" value="${t}" ${chk(prop.lease_terms,t)}> ${t}</label>`).join('')}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="laundryType">Laundry</label>
        <select class="form-select" id="laundryType">
          <option value="" ${!prop.laundry_type?'selected':''}>Select laundry situation</option>
          ${[
            ['In-unit washer/dryer','In-unit washer/dryer included'],
            ['Hookups only','Washer/dryer hookups only (tenant brings)'],
            ['Shared laundry','Shared laundry on-site'],
            ['Laundromat nearby','No on-site laundry (laundromat nearby)'],
            ['None','No laundry facilities']
          ].map(([v,l])=>`<option value="${v}" ${prop.laundry_type===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="heatingType">Heating</label>
          <select class="form-select" id="heatingType">
            <option value="" ${!prop.heating_type?'selected':''}>Select heating type</option>
            ${[
              ['Forced air (gas)','Forced air — gas'],
              ['Forced air (electric)','Forced air — electric'],
              ['Baseboard electric','Baseboard electric'],
              ['Radiant/in-floor','Radiant / in-floor'],
              ['Heat pump','Heat pump'],
              ['Boiler/radiator','Boiler / radiator'],
              ['Other','Other']
            ].map(([v,l])=>`<option value="${v}" ${prop.heating_type===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="coolingType">Cooling / A/C</label>
          <select class="form-select" id="coolingType">
            <option value="" ${!prop.cooling_type?'selected':''}>Select cooling type</option>
            ${[
              ['Central A/C','Central A/C'],
              ['Mini-split','Mini-split (ductless)'],
              ['Window units','Window units'],
              ['Evaporative cooler','Evaporative cooler'],
              ['None','No A/C']
            ].map(([v,l])=>`<option value="${v}" ${prop.cooling_type===v?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label" for="hasCentralAir">Central Air</label>
          <select class="form-select" id="hasCentralAir">
            <option value="" ${prop.has_central_air===null||prop.has_central_air===undefined?'selected':''}>Unknown / Not specified</option>
            <option value="true" ${prop.has_central_air===true?'selected':''}>Yes</option>
            <option value="false" ${prop.has_central_air===false?'selected':''}>No</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="hasBasement">Basement</label>
          <select class="form-select" id="hasBasement">
            <option value="" ${prop.has_basement===null||prop.has_basement===undefined?'selected':''}>Unknown / Not specified</option>
            <option value="true" ${prop.has_basement===true?'selected':''}>Yes</option>
            <option value="false" ${prop.has_basement===false?'selected':''}>No</option>
          </select>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:var(--sp-5) 0">
      <div class="form-section-title">Photos</div>
      <p class="photo-count-hint">
        The first photo is the cover shown in search results. Click ★ to set a new cover or ✕ to remove a photo.
      </p>

      <div class="existing-photos-grid" id="existingPhotosGrid"></div>

      <div class="photo-dropzone" id="photoDropzone" style="margin-bottom:var(--sp-3)">
        <h4>Add more photos</h4>
        <p>Drag &amp; drop or click to browse · JPG, PNG, WEBP</p>
        <input type="file" id="photoInput" multiple accept="image/*" style="opacity:0;position:absolute;width:0;height:0;pointer-events:none;">
      </div>

      <div class="photo-preview-grid" id="newPhotosGrid"></div>

      <div id="uploadProgress" style="display:none;margin-top:var(--sp-3)">
        <div style="display:flex;justify-content:space-between;font-size:.82rem;margin-bottom:6px">
          <span id="uploadStatusText">Uploading…</span>
          <span id="uploadPct">0%</span>
        </div>
        <div class="photo-upload-progress"><div class="photo-upload-bar" id="uploadBar" style="width:0%"></div></div>
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:var(--sp-5) 0">
      <div class="form-section-title">Description</div>
      <div class="form-group">
        <label class="form-label" for="description">Property Description *</label>
        <textarea class="form-textarea" id="description" rows="7" style="min-height:160px">${esc(prop.description||'')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label" for="showingInstructions">Showing Instructions</label>
        <input type="text" class="form-input" id="showingInstructions" value="${esc(prop.showing_instructions||'')}" placeholder="e.g. Contact to schedule, lockbox available">
      </div>

      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-md);padding:var(--sp-4);margin-top:var(--sp-4)">
        <h4 style="font-size:.9rem;font-weight:700;color:var(--text);margin:0 0 var(--sp-2)">Listing Attestation</h4>
        <p style="font-size:.82rem;color:var(--muted);margin:0 0 var(--sp-3)">By saving changes, you confirm the following.</p>
        <div style="display:flex;flex-direction:column;gap:var(--sp-2)">
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:.82rem;color:var(--muted);line-height:1.5">
            <input type="checkbox" id="editAttestAccuracy" required style="margin-top:3px;flex-shrink:0">
            <span>The information in this listing is accurate and truthful, and this property is legally available for rent at the listed price.</span>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:.82rem;color:var(--muted);line-height:1.5">
            <input type="checkbox" id="editAttestFairHousing" required style="margin-top:3px;flex-shrink:0">
            <span>I agree to comply with the <a href="/fair-housing.html" target="_blank" style="color:var(--brand)">Fair Housing Act</a> and all applicable fair housing laws.</span>
          </label>
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:.82rem;color:var(--muted);line-height:1.5">
            <input type="checkbox" id="editAttestPolicy" required style="margin-top:3px;flex-shrink:0">
            <span>I agree to the Choice Properties <a href="/terms.html" target="_blank" style="color:var(--brand)">Terms of Service</a> and platform policies.</span>
          </label>
        </div>
      </div>

      <div class="form-nav" style="margin-top:var(--sp-5)">
        <a href="${backURL}" class="btn btn-ghost">← Cancel</a>
        <button class="btn btn-primary btn-lg" id="saveBtn">Save Changes</button>
      </div>

      <div class="danger-zone">
        <div class="danger-zone-title">Danger Zone</div>
        <div class="danger-zone-desc">Permanently delete this listing. All photos and data will be removed and cannot be recovered.</div>
        <button class="btn btn-danger" id="openDeleteBtn">Delete This Listing</button>
      </div>

    </div>`;

  // Pet details toggle
  document.querySelectorAll('input[name="pets"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('petDetailsWrap').style.display =
        document.querySelector('input[name="pets"]:checked')?.value === 'true' ? '' : 'none';
    });
  });

  // ── Auto-save Pill Helper ───────────────────────────────
  function setAutoSavePill(state, text) {
    const pill = document.getElementById('autoSavePill');
    if (!pill) return;
    pill.className = 'auto-save-pill' + (state ? ` ${state}` : '');
    pill.textContent = text;
  }

  // ── Full-size Swipeable Photo Lightbox ──────────────────
  let _lbUrls = [];
  let _lbIndex = 0;

  function _ensureLightboxEl() {
    let overlay = document.getElementById('cp-landlord-lightbox');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'cp-landlord-lightbox';
    overlay.className = 'cp-lb-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Full-size photo viewer');
    overlay.innerHTML = `
      <button type="button" class="cp-lb-close" id="cpLbClose" aria-label="Close photo viewer">✕</button>
      <div class="cp-lb-stage" id="cpLbStage">
        <button type="button" class="cp-lb-btn cp-lb-prev" id="cpLbPrev" aria-label="Previous photo">‹</button>
        <img class="cp-lb-img" id="cpLbImg" src="" alt="Full-size property photo">
        <button type="button" class="cp-lb-btn cp-lb-next" id="cpLbNext" aria-label="Next photo">›</button>
      </div>
      <div class="cp-lb-counter" id="cpLbCounter">1 / 1</div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function _renderLightbox() {
    const overlay = _ensureLightboxEl();
    const img = overlay.querySelector('#cpLbImg');
    const counter = overlay.querySelector('#cpLbCounter');
    const prev = overlay.querySelector('#cpLbPrev');
    const next = overlay.querySelector('#cpLbNext');
    if (!_lbUrls.length) return;
    if (_lbIndex < 0) _lbIndex = _lbUrls.length - 1;
    if (_lbIndex >= _lbUrls.length) _lbIndex = 0;
    img.src = _lbUrls[_lbIndex];
    counter.textContent = `${_lbIndex + 1} / ${_lbUrls.length}`;
    const single = _lbUrls.length <= 1;
    if (prev) prev.style.display = single ? 'none' : '';
    if (next) next.style.display = single ? 'none' : '';
  }

  function closeLandlordLightbox() {
    const overlay = document.getElementById('cp-landlord-lightbox');
    if (!overlay || !overlay.classList.contains('is-open')) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', _onLbKeydown, true);
  }

  function _onLbKeydown(e) {
    const overlay = document.getElementById('cp-landlord-lightbox');
    if (!overlay || !overlay.classList.contains('is-open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeLandlordLightbox();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      _lbIndex--;
      _renderLightbox();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      _lbIndex++;
      _renderLightbox();
    }
  }

  let _lbWired = false;
  function openLandlordLightbox(urls, startIdx = 0) {
    const clean = (Array.isArray(urls) ? urls : []).filter(Boolean);
    if (!clean.length) return;
    _lbUrls = clean;
    _lbIndex = Math.max(0, Math.min(startIdx, clean.length - 1));
    const overlay = _ensureLightboxEl();
    if (!_lbWired) {
      _lbWired = true;
      overlay.querySelector('#cpLbClose')?.addEventListener('click', closeLandlordLightbox);
      overlay.querySelector('#cpLbPrev')?.addEventListener('click', (e) => { e.stopPropagation(); _lbIndex--; _renderLightbox(); });
      overlay.querySelector('#cpLbNext')?.addEventListener('click', (e) => { e.stopPropagation(); _lbIndex++; _renderLightbox(); });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.id === 'cpLbStage') closeLandlordLightbox();
      });
      let touchStartX = 0;
      let touchStartY = 0;
      const stage = overlay.querySelector('#cpLbStage');
      stage?.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }, { passive: true });
      stage?.addEventListener('touchend', (e) => {
        if (!touchStartX) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        touchStartX = 0; touchStartY = 0;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          _lbIndex += dx < 0 ? 1 : -1;
          _renderLightbox();
        }
      }, { passive: true });
    }
    _renderLightbox();
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', _onLbKeydown, true);
  }

  // ── Photos ──────────────────────────────────────────────
  function _syncPhotoArraysFromObjects() {
    currentPhotoUrls    = currentPhotos.map(x => x.url);
    currentPhotoFileIds = currentPhotos.map(x => x.file_id ?? null);
    prop.property_photos = currentPhotos.slice();
    prop.photo_urls      = [...currentPhotoUrls];
    prop.photo_file_ids  = [...currentPhotoFileIds];
  }

  async function _refreshPhotosFromServer() {
    const { data: freshRows } = await supabase
      .from('property_photos')
      .select('id, url, file_id, display_order')
      .eq('property_id', propertyId)
      .order('display_order', { ascending: true });
    if (Array.isArray(freshRows)) {
      currentPhotos = freshRows.filter(x => x && x.url).map((x, idx) => ({
        id: x.id || null,
        url: x.url,
        file_id: x.file_id ?? null,
        display_order: x.display_order ?? idx,
      }));
      _syncPhotoArraysFromObjects();
      originalPhotoFileIds = [...currentPhotoFileIds];
    }
  }

  function renderExistingPhotos() {
    const grid = document.getElementById('existingPhotosGrid');
    if (!currentPhotoUrls.length) {
      grid.innerHTML = `<p style="color:var(--muted);font-size:.82rem;grid-column:1/-1">No photos yet. Add some below.</p>`;
      return;
    }
    grid.innerHTML = currentPhotoUrls.map((url, i) => `
      <div class="existing-photo-item ${i === 0 ? 'is-cover' : ''}" id="epItem-${i}" data-idx="${i}" title="Tap to view full size">
        <img src="${esc(url)}" alt="Photo ${i+1}" loading="lazy">
        ${i === 0 ? '<div class="cover-label">Cover</div>' : ''}
        <div class="photo-action-bar">
          ${i !== 0 ? `<button type="button" class="photo-action-btn cover-btn" title="Set as cover" data-action="set-cover" data-idx="${i}">★</button>` : ''}
          <button type="button" class="photo-action-btn delete-btn" title="Remove photo" data-action="remove-photo" data-idx="${i}">✕</button>
        </div>
      </div>`).join('');
  }
  renderExistingPhotos();

  // Set min available date to today
  const _availEl = document.getElementById('availDate');
  if (_availEl) _availEl.min = new Date().toISOString().split('T')[0];

  // Delegated photo actions + click-to-view full size
  document.getElementById('existingPhotosGrid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) {
      const card = e.target.closest('.existing-photo-item');
      if (card && !e.target.closest('.photo-action-bar')) {
        const idx = parseInt(card.dataset.idx, 10) || 0;
        openLandlordLightbox(currentPhotoUrls, idx);
      }
      return;
    }
    const idx = parseInt(btn.dataset.idx, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= currentPhotos.length) return;

    if (btn.dataset.action === 'set-cover') {
      const moved = currentPhotos.splice(idx, 1)[0];
      currentPhotos.unshift(moved);
      currentPhotos.forEach((ph, order) => { ph.display_order = order; });
      _syncPhotoArraysFromObjects();
      renderExistingPhotos();
      setAutoSavePill('saving', 'Saving cover…');
      try {
        await Promise.all(
          currentPhotos.map((ph, order) =>
            ph.id
              ? supabase.from('property_photos').update({ display_order: order, is_hero: order === 0 }).eq('id', ph.id)
              : Promise.resolve()
          )
        );
        setAutoSavePill('saved', 'Saved ✓');
        CP.UI.toast('Cover photo updated and saved.', 'success');
      } catch (err) {
        setAutoSavePill('error', 'Cover save failed');
        CP.UI.toast('Could not save cover order.', 'error');
      }
    } else if (btn.dataset.action === 'remove-photo') {
      const removed = currentPhotos.splice(idx, 1)[0];
      currentPhotos.forEach((ph, order) => { ph.display_order = order; });
      _syncPhotoArraysFromObjects();
      renderExistingPhotos();
      setAutoSavePill('saving', 'Removing photo…');
      try {
        if (removed.id) {
          const { error: delErr } = await supabase.from('property_photos').delete().eq('id', removed.id);
          if (delErr) throw delErr;
        } else {
          const { error: delErr } = await supabase
            .from('property_photos')
            .delete()
            .eq('property_id', propertyId)
            .eq('url', removed.url);
          if (delErr) throw delErr;
        }
        await Promise.all(
          currentPhotos.map((ph, order) =>
            ph.id
              ? supabase.from('property_photos').update({ display_order: order, is_hero: order === 0 }).eq('id', ph.id)
              : Promise.resolve()
          )
        );
        setAutoSavePill('saved', 'Saved ✓');
        CP.UI.toast('Photo removed and saved.', 'success');

        if (removed.file_id && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
          const session = await CP.getSession().catch(() => null);
          const userToken = session?.access_token || CONFIG.SUPABASE_ANON_KEY;
          deleteFromImageKit(removed.file_id, {
            supabaseUrl: CONFIG.SUPABASE_URL,
            anonKey: CONFIG.SUPABASE_ANON_KEY,
            userToken,
          }).catch(() => {});
        }
      } catch (err) {
        setAutoSavePill('error', 'Remove failed');
        CP.UI.toast('Failed to remove photo from listing.', 'error');
      }
    }
  });

  // ── New photo upload (instant preview + immediate auto-upload & live sync) ──
  const dropzone   = document.getElementById('photoDropzone');
  const photoInput = document.getElementById('photoInput');

  dropzone.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('click', e => e.stopPropagation());
  photoInput.addEventListener('change', e => handleNewFiles([...e.target.files]));
  dropzone.addEventListener('dragover',  e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    handleNewFiles([...e.dataTransfer.files]);
  });

  let _uploadQueueRunning = false;

  async function _processPendingUploads() {
    if (_uploadQueueRunning || pendingNewFiles.length === 0) return;
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      CP.UI.toast('Photo uploads are not configured yet.', 'error');
      return;
    }

    _uploadQueueRunning = true;
    const progressEl = document.getElementById('uploadProgress');
    const bar        = document.getElementById('uploadBar');
    const txt        = document.getElementById('uploadStatusText');
    const pctLbl     = document.getElementById('uploadPct');

    try {
      const accessToken = await window.CP?.Auth?.getAccessToken?.();
      if (!accessToken) {
        setAutoSavePill('error', 'Session expired');
        CP.UI.toast('Session expired — please log back in to upload photos.', 'error');
        return;
      }

      while (pendingNewFiles.length > 0) {
        const batchFiles = pendingNewFiles.splice(0, pendingNewFiles.length);
        pendingNewPreviews.splice(0, pendingNewPreviews.length);
        setAutoSavePill('saving', `Uploading ${batchFiles.length} photo${batchFiles.length > 1 ? 's' : ''}…`);
        if (progressEl) progressEl.style.display = '';
        if (bar) bar.style.width = '0%';
        if (pctLbl) pctLbl.textContent = '0%';
        if (txt) txt.textContent = `Uploading photos… (0 of ${batchFiles.length} done)`;

        let doneCount = 0;
        const results = await uploadMultipleToImageKit(batchFiles, {
          folder:      `/properties/${propertyId}`,
          propertyId,
          supabaseUrl: CONFIG.SUPABASE_URL,
          anonKey:     CONFIG.SUPABASE_ANON_KEY,
          userToken:   accessToken,
          onFileProgress: (i, pct) => {
            if (pct === 100) doneCount++;
            if (txt) txt.textContent = `Uploading photos… (${doneCount} of ${batchFiles.length} done)`;
          },
          onTotalProgress: (overall) => {
            if (bar) bar.style.width = overall + '%';
            if (pctLbl) pctLbl.textContent = overall + '%';
          },
        });

        const failed = [];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          const f = batchFiles[i];
          const previewEl = document.getElementById(`np-${CSS.escape(`${f.name}-${f.size}`)}`);
          if (r?.url) {
            if (!r.photoId) {
              try {
                await supabase.rpc('add_property_photo', {
                  p_property_id: propertyId,
                  p_url:         r.url,
                  p_file_id:     r.fileId || '',
                });
              } catch (rpcErr) {
                console.warn('add_property_photo fallback failed:', rpcErr);
              }
            }
            previewEl?.remove();
          } else {
            failed.push(r?.fileName || f?.name || 'photo');
          }
        }

        await _refreshPhotosFromServer();
        renderExistingPhotos();

        if (failed.length) {
          setAutoSavePill('error', `${failed.length} upload failed`);
          CP.UI.toast(`Could not upload: ${failed.join(', ')}`, 'error');
        } else {
          setAutoSavePill('saved', 'Saved ✓');
          CP.UI.toast(`${batchFiles.length} photo${batchFiles.length > 1 ? 's' : ''} added and saved!`, 'success');
        }
      }
    } catch (uploadErr) {
      setAutoSavePill('error', 'Upload failed');
      CP.UI.toast('Photo upload failed: ' + (uploadErr.message || uploadErr), 'error');
    } finally {
      _uploadQueueRunning = false;
      if (progressEl) progressEl.style.display = 'none';
    }
  }

  function handleNewFiles(files) {
    const MAX_PHOTOS = 40;
    let addedAny = false;
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (['image/heic','image/heif'].includes(file.type.toLowerCase()) || /\.heic$/i.test(file.name)) {
        CP.UI.toast(`"${file.name}" is in HEIC format (iPhone default). Go to Settings → Camera → Formats → Most Compatible to shoot in JPG, then re-upload.`, 'error');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        CP.UI.toast(`"${file.name}" is too large (${(file.size / 1048576).toFixed(1)} MB). Max 10 MB per photo.`, 'error');
        return;
      }
      if (pendingNewFiles.find(f => f.name === file.name && f.size === file.size)) return;
      const existingCount = document.querySelectorAll('#existingPhotosGrid .existing-photo-item').length;
      if (existingCount + pendingNewFiles.length >= MAX_PHOTOS) {
        CP.UI.toast(`Maximum ${MAX_PHOTOS} photos allowed per listing.`, 'error');
        return;
      }
      pendingNewFiles.push(file);
      addedAny = true;
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingNewPreviews.push(e.target.result);
        addNewPhotoPreview(e.target.result, file);
      };
      reader.readAsDataURL(file);
    });
    photoInput.value = '';
    if (addedAny) _processPendingUploads();
  }

  function addNewPhotoPreview(src, file) {
    const grid = document.getElementById('newPhotosGrid');
    const item = document.createElement('div');
    item.className = 'photo-preview-item';
    item.id        = `np-${file.name}-${file.size}`;
    item.title     = 'Tap to view full size';
    item.innerHTML = `<img src="${src}" alt="Preview" loading="lazy"><button type="button" class="photo-remove-btn" title="Remove">✕</button>`;
    item.querySelector('.photo-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      pendingNewFiles = pendingNewFiles.filter(f => !(f.name === file.name && f.size === file.size));
      item.remove();
    });
    item.addEventListener('click', (e) => {
      if (e.target.closest('.photo-remove-btn')) return;
      const urls = [...grid.querySelectorAll('.photo-preview-item img')].map(img => img.src).filter(Boolean);
      const idx = Math.max(0, urls.indexOf(item.querySelector('img')?.src));
      if (urls.length) openLandlordLightbox(urls, idx);
    });
    grid.appendChild(item);
  }

  // ── Auto-save + live UI reflection + stay on page ───────
  let _editDirty      = false;
  let _autoSaveTimer  = null;
  let _isSaving       = false;
  let _resaveQueued   = false;
  let _pendingManual  = false;

  const formCard = document.getElementById('formCard');

  function _isAutoSaveIgnoredTarget(target) {
    if (!target) return true;
    if (target.id === 'photoInput') return true;
    if (['editAttestAccuracy', 'editAttestFairHousing', 'editAttestPolicy'].includes(target.id)) return true;
    return false;
  }

  function _scheduleAutoSave() {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(() => { saveListing({ silent: true }); }, 800);
  }

  formCard.addEventListener('input', (e) => {
    if (_isAutoSaveIgnoredTarget(e.target)) return;
    _editDirty = true;
    setAutoSavePill('saving', 'Unsaved…');
    _scheduleAutoSave();
  });

  formCard.addEventListener('change', (e) => {
    if (_isAutoSaveIgnoredTarget(e.target)) return;
    _editDirty = true;
    clearTimeout(_autoSaveTimer);
    saveListing({ silent: true });
  });

  window.addEventListener('beforeunload', (e) => {
    if (_editDirty) { e.preventDefault(); e.returnValue = ''; }
  });

  // ── Save listing ────────────────────────────────────────
  document.getElementById('saveBtn').addEventListener('click', () => {
    clearTimeout(_autoSaveTimer);
    saveListing({ silent: false });
  });

  async function saveListing(opts = {}) {
    const silent = opts && opts.silent === true;
    if (_isSaving) {
      _resaveQueued = true;
      if (!silent) _pendingManual = true;
      return;
    }

    const btn = document.getElementById('saveBtn');
    const v   = id => document.getElementById(id)?.value?.trim();

    const failValidation = (toastMsg, pillMsg) => {
      setAutoSavePill('error', pillMsg);
      if (!silent) CP.UI.toast(toastMsg, 'error');
      return false;
    };

    if (!v('title'))                          return failValidation('Please enter a listing title.', 'Title required');
    if (v('title').length > 120)              return failValidation('Title must be 120 characters or less.', 'Title too long');
    if (!v('propertyType'))                   return failValidation('Please select a property type.', 'Type required');
    if (!v('address'))                        return failValidation('Please enter the property address.', 'Address required');
    if (!v('city'))                           return failValidation('Please enter the city.', 'City required');
    if (!v('state'))                          return failValidation('Please select a state.', 'State required');
    if (!v('zip'))                            return failValidation('Please enter the ZIP code.', 'ZIP required');
    if (!/^\d{5}(-\d{4})?$/.test(v('zip')))  return failValidation('Please enter a valid ZIP code (e.g. 90210).', 'Invalid ZIP');
    if (!v('bedrooms'))                       return failValidation('Please select the number of bedrooms.', 'Beds required');
    if (!v('bathrooms'))                      return failValidation('Please select the number of bathrooms.', 'Baths required');
    if (!v('rent') || parseInt(v('rent')) < 1) return failValidation('Please enter a valid monthly rent.', 'Rent required');
    if (parseInt(v('rent')) > 50000)          return failValidation('Monthly rent looks too high — please double-check.', 'Rent too high');
    const totalPhotos = currentPhotoUrls.length + pendingNewFiles.length;
    if (!silent && totalPhotos < 3)           return failValidation('Please include at least 3 photos for a complete listing.', 'Min 3 photos');
    if (!v('description') || v('description').length < 50) return failValidation('Please write a description of at least 50 characters.', 'Description min 50 chars');

    _isSaving = true;
    setAutoSavePill('saving', 'Saving…');
    if (!silent && btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      // Geocode if address changed
      let lat = prop.lat || null;
      let lng = prop.lng || null;
      const addressChanged = v('address') !== prop.address || v('city') !== prop.city || v('zip') !== prop.zip;
      if (addressChanged || (!lat && !lng)) {
        try {
          const fullAddr = `${v('address')}, ${v('city')}, ${v('state')} ${v('zip')}`.trim();
          const _geoKey = (typeof CONFIG !== 'undefined' && CONFIG.GEOAPIFY_API_KEY) || '';
          if (_geoKey) {
            const geoRes = await fetch(
              `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(fullAddr)}&format=json&apiKey=${_geoKey}&filter=countrycode:us&limit=1`
            );
            const geoData = await geoRes.json();
            const hit = geoData?.results?.[0];
            if (hit) { lat = parseFloat(hit.lat); lng = parseFloat(hit.lon); }
          }
        } catch (e) { /* silent */ }
      }

      const getChecked = name => [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(c => c.value);

      const payload = {
        title               : v('title'),
        property_type       : v('propertyType'),
        address             : v('address'),
        unit_number         : v('unitNumber') || null,
        city                : v('city'),
        state               : v('state') || null,
        zip                 : v('zip') || null,
        county              : v('county') || null,
        neighborhood        : v('neighborhood') || null,
        lat, lng,
        bedrooms            : parseInt(v('bedrooms')),
        bathrooms           : parseFloat(v('bathrooms')),
        half_bathrooms      : v('halfBathrooms') ? parseInt(v('halfBathrooms')) : null,
        square_footage      : parseInt(v('sqft')) || null,
        lot_size_sqft       : v('lotSizeSqft') ? parseInt(v('lotSizeSqft')) : null,
        floors              : v('floors') ? parseInt(v('floors')) : null,
        year_built          : v('yearBuilt') ? parseInt(v('yearBuilt')) : null,
        monthly_rent        : parseInt(v('rent')),
        security_deposit    : parseInt(v('deposit')) || null,
        last_months_rent    : v('lastMonthRent') ? parseInt(v('lastMonthRent')) : null,
        admin_fee           : v('adminFee') ? parseInt(v('adminFee')) : null,
        move_in_special     : v('moveInSpecial') || null,
        available_date      : v('availDate') || null,
        application_fee     : parseInt(v('appFee')) || 0,
        status              : v('status'),
        pets_allowed        : document.querySelector('input[name="pets"]:checked')?.value === 'true',
        pet_types_allowed   : document.querySelector('input[name="pets"]:checked')?.value === 'true'
                                ? [...document.querySelectorAll('#petTypesGroup input:checked')].map(c => c.value)
                                : [],
        pet_weight_limit    : v('petWeightLimit') ? parseInt(v('petWeightLimit')) : null,
        pet_deposit         : v('petDeposit') ? parseInt(v('petDeposit')) : null,
        pet_details         : v('petDetails') || null,
        parking             : v('parking') || null,
        garage_spaces       : v('garageSpaces') ? parseInt(v('garageSpaces')) : null,
        parking_fee         : v('parkingFee') ? parseInt(v('parkingFee')) : null,
        ev_charging         : v('evCharging') || null,
        utilities_included  : getChecked('utilities'),
        amenities           : getChecked('amenities'),
        appliances          : getChecked('appliances'),
        flooring            : getChecked('flooring'),
        lease_terms         : getChecked('leaseTerms'),
        laundry_type        : v('laundryType') || null,
        heating_type        : v('heatingType') || null,
        cooling_type        : v('coolingType') || null,
        has_central_air     : v('hasCentralAir') === 'true' ? true : v('hasCentralAir') === 'false' ? false : null,
        has_basement        : v('hasBasement') === 'true' ? true : v('hasBasement') === 'false' ? false : null,
        description         : v('description'),
        showing_instructions: v('showingInstructions') || null,
        minimum_income_multiplier: v('minIncome') ? parseFloat(v('minIncome')) : null,
        minimum_credit_score     : v('minCredit') ? parseInt(v('minCredit')) : null,
        updated_at          : new Date().toISOString()
      };

      let updateQuery = supabase.from('properties').update(payload).eq('id', propertyId);
      if (!_isAdmin && profile) updateQuery = updateQuery.eq('landlord_id', profile.id);
      const { error } = await updateQuery;

      if (error) {
        setAutoSavePill('error', 'Save failed');
        if (!silent) CP.UI.toast('Failed to save. Please try again.', 'error');
        return;
      }

      // Live UI & memory reflection — stay on edit page
      Object.assign(prop, payload);
      const pageTitleEl = document.getElementById('pageTitle');
      if (pageTitleEl) pageTitleEl.textContent = payload.title;
      document.title = `${payload.title} — Edit Listing — Choice Properties`;
      _editDirty = false;
      setAutoSavePill('saved', 'Saved ✓');

      if (!silent) {
        CP.UI.toast('Listing updated successfully! <a href="/property.html?id=' + propertyId + '" target="_blank" style="color:inherit;text-decoration:underline">View listing →</a>', 'success');
        if (btn) {
          btn.textContent = 'Saved!';
          setTimeout(() => { btn.disabled = false; btn.textContent = 'Save Changes'; }, 2000);
        }
      }
    } finally {
      _isSaving = false;
      if (!silent && btn && btn.textContent === 'Saving…') {
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
      if (_resaveQueued) {
        const manualNext = _pendingManual;
        _resaveQueued = false;
        _pendingManual = false;
        saveListing({ silent: !manualNext });
      }
    }
  }

  // ── Delete listing ──────────────────────────────────────
  const deleteModal      = document.getElementById('deleteModal');
  const openDeleteBtn    = document.getElementById('openDeleteBtn');
  const cancelDeleteBtn  = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

  openDeleteBtn.addEventListener('click', async () => {
    const { count } = await supabase
      .from('applications')
      .select('app_id', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .in('status', ['pending', 'under_review', 'approved', 'waitlisted']);

    const warningEl = document.getElementById('deleteWarning');
    if (count && count > 0) {
      warningEl.style.display = '';
      warningEl.innerHTML = `⚠️ This listing has <strong>${count} active application${count === 1 ? '' : 's'}</strong>. Deleting it will not automatically notify those applicants.`;
    } else {
      warningEl.style.display = 'none';
    }
    deleteModal.classList.add('is-open');
  });

  cancelDeleteBtn.addEventListener('click', () => deleteModal.classList.remove('is-open'));
  deleteModal.addEventListener('click', e => { if (e.target === deleteModal) deleteModal.classList.remove('is-open'); });

  confirmDeleteBtn.addEventListener('click', async () => {
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting…';

    let deleteQuery = supabase.from('properties').delete().eq('id', propertyId);
    if (!_isAdmin && profile) deleteQuery = deleteQuery.eq('landlord_id', profile.id);
    const { error } = await deleteQuery;

    if (error) {
      CP.UI.toast('Failed to delete. Please try again.', 'error');
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Yes, delete';
      deleteModal.classList.remove('is-open');
      return;
    }

    const fileIdsToDelete = currentPhotoFileIds.filter(Boolean);
    if (fileIdsToDelete.length) {
      const session = await CP.getSession().catch(() => null);
      const userToken = session?.access_token || CONFIG.SUPABASE_ANON_KEY;
      for (const fileId of fileIdsToDelete) {
        deleteFromImageKit(fileId, {
          supabaseUrl: CONFIG.SUPABASE_URL,
          anonKey: CONFIG.SUPABASE_ANON_KEY,
          userToken,
        });
      }
    }

    _editDirty = false;
    CP.UI.toast('Listing deleted.', 'success');
    setTimeout(() => window.location.href = backURL, 1500);
  });


