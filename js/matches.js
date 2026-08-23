import { buildApplyURL } from '/js/cp-api.js';

const esc = window.CP?.UI?.esc || (s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));

async function loadMatches() {
  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('id');
  const headerContainer = document.getElementById('matchHeaderContainer');
  const grid = document.getElementById('propertyGrid');

  if (!matchId) {
    headerContainer.innerHTML = `
      <div class="match-header">
        <h1>Matches Not Found</h1>
        <p>This link appears to be invalid or expired.</p>
      </div>`;
    return;
  }

  try {
    // 1. Fetch the collection
    const { data: collection, error: colError } = await window.CP.sb()
      .from('client_collections')
      .select('*')
      .eq('id', matchId)
      .single();

    if (colError || !collection) {
      throw new Error('Collection not found');
    }

    // 2. Update Header
    headerContainer.innerHTML = `
      <div class="match-header">
        <h1>Hand-picked Properties for ${esc(collection.client_name)}</h1>
        <p>We thought you might love these options.</p>
      </div>`;
      
    document.title = `Properties for ${collection.client_name} — Choice Properties`;

    // 3. Fetch properties
    if (!collection.property_ids || collection.property_ids.length === 0) {
      grid.innerHTML = `
        <div class="match-empty" style="grid-column: 1 / -1">
          <i class="fas fa-search"></i>
          <h2>No properties found</h2>
          <p>This collection is currently empty.</p>
        </div>`;
      return;
    }

    const { data: properties, error: propError } = await window.CP.sb()
      .from('properties')
      .select('*, landlords(verified), property_photos(url, display_order)')
      .in('id', collection.property_ids)
      .eq('status', 'active');

    if (propError) throw propError;

    if (!properties || properties.length === 0) {
      grid.innerHTML = `
        <div class="match-empty" style="grid-column: 1 / -1">
          <i class="fas fa-home-slash"></i>
          <h2>No active properties</h2>
          <p>The properties in this collection are no longer available.</p>
        </div>`;
      return;
    }

    // 4. Render Properties
    const _sortedProps = properties.map(p => {
      let photos = Array.isArray(p.property_photos) ? p.property_photos.slice() : [];
      photos.sort((a,b) => (a.display_order || 0) - (b.display_order || 0));
      p.photo_urls = photos.map(x => x.url).filter(Boolean);
      return p;
    });

    const htmls = _sortedProps.map(p => window.buildPropertyCard(p, {
      imgSizes: '(max-width: 599px) calc(100vw - 32px), 300px',
    }));
    
    grid.innerHTML = htmls.join('');
    let delayIdx = 0;
    grid.querySelectorAll('.property-card').forEach(c => {
      c.style.setProperty('--cp-delay', Math.min(delayIdx * 55, 320) + 'ms');
      window.initCardCarousel(c);
      setTimeout(() => c.classList.add('cp-card-visible'), 50);
      delayIdx++;
    });

  } catch (err) {
    console.error('Error loading matches:', err); if(grid){grid.innerHTML='<pre style="color:red;padding:20px">'+String(err.stack || err)+'</pre>';}
    headerContainer.innerHTML = `
      <div class="match-header">
        <h1>Collection Not Found</h1>
        <p>We couldn't load these matches. The link may have expired.</p>
      </div>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMatches);
} else {
  loadMatches();
}
