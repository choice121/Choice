import { buildApplyURL } from '/js/cp-api.js';

const esc = (s) => (window.CP?.UI?.esc ? window.CP.UI.esc(s) : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'));

function setupThemeToggle() {
  const toggleBtn = document.querySelector('[data-theme-toggle]');
  if (!toggleBtn) return;
  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cp-theme', next); } catch (_) {}
  });
}

async function waitForDependencies() {
  let attempts = 0;
  while ((!window.CP?.sb || !window.buildPropertyCard) && attempts < 50) {
    await new Promise(r => setTimeout(r, 50));
    attempts++;
  }
}

async function loadMatches() {
  setupThemeToggle();

  const params = new URLSearchParams(window.location.search);
  const matchId = params.get('id');
  const headerContainer = document.getElementById('matchHeaderContainer');
  const grid = document.getElementById('propertyGrid');

  if (!matchId) {
    if (headerContainer) {
      headerContainer.innerHTML = `
        <div class="match-header">
          <div class="match-header-badge"><i class="fas fa-exclamation-triangle"></i> Invalid Link</div>
          <h1>Matches Not Found</h1>
          <p>This collection link appears to be invalid or missing an ID.</p>
        </div>`;
    }
    if (grid) grid.innerHTML = '';
    return;
  }

  try {
    await waitForDependencies();

    if (!window.CP?.sb) {
      throw new Error('Supabase client failed to initialize');
    }

    const sb = window.CP.sb();

    // 1. Fetch the collection via secure RPC
    const { data: rawData, error: colError } = await sb
      .rpc('get_client_collection', { collection_id: matchId });

    if (colError) {
      console.error('RPC Error:', colError);
      throw colError;
    }

    const collection = Array.isArray(rawData) ? rawData[0] : rawData;

    if (!collection || !collection.client_name) {
      throw new Error('Collection not found');
    }

    // 2. Update Header
    if (headerContainer) {
      headerContainer.innerHTML = `
        <div class="match-header">
          <div class="match-header-badge"><i class="fas fa-sparkles"></i> Curated Collection</div>
          <h1>Hand-picked Properties for ${esc(collection.client_name)}</h1>
          <p>We thought you might love these options.</p>
        </div>`;
    }
      
    document.title = `Properties for ${collection.client_name} — Choice Properties`;

    // 3. Fetch properties
    if (!collection.property_ids || collection.property_ids.length === 0) {
      if (grid) {
        grid.innerHTML = `
          <div class="match-empty" style="grid-column: 1 / -1">
            <i class="fas fa-search"></i>
            <h2>No properties found</h2>
            <p>This collection is currently empty.</p>
          </div>`;
      }
      return;
    }

    const { data: properties, error: propError } = await sb
      .from('properties')
      .select('*, landlords(verified), property_photos(url, display_order)')
      .in('id', collection.property_ids)
      .eq('status', 'active');

    if (propError) throw propError;

    if (!properties || properties.length === 0) {
      if (grid) {
        grid.innerHTML = `
          <div class="match-empty" style="grid-column: 1 / -1">
            <i class="fas fa-home-slash"></i>
            <h2>No active properties</h2>
            <p>The properties in this collection are no longer available.</p>
          </div>`;
      }
      return;
    }

    // Preserve order matching collection.property_ids
    const propMap = new Map(properties.map(p => [p.id, p]));
    const orderedProps = collection.property_ids
      .map(id => propMap.get(id))
      .filter(Boolean);

    // 4. Render Properties
    const _sortedProps = orderedProps.map(p => {
      let photos = Array.isArray(p.property_photos) ? p.property_photos.slice() : [];
      photos.sort((a,b) => (a.display_order || 0) - (b.display_order || 0));
      p.photo_urls = photos.map(x => x.url).filter(Boolean);
      return p;
    });

    if (typeof window.buildPropertyCard !== 'function') {
      throw new Error('Card builder function unavailable');
    }

    const htmls = _sortedProps.map(p => window.buildPropertyCard(p, {
      imgSizes: '(max-width: 599px) calc(100vw - 32px), 300px',
    }));
    
    if (grid) {
      grid.innerHTML = htmls.join('');
      if (typeof window.initCardCarousel === 'function') {
        grid.querySelectorAll('.property-card').forEach(window.initCardCarousel);
      }
      
      // Append embedded=true to all property links
      grid.querySelectorAll('a').forEach(a => {
        if (a.href && a.href.includes('property.html')) {
          try {
            const u = new URL(a.href, window.location.origin);
            u.searchParams.set('embedded', 'true');
            a.href = u.toString();
          } catch (_) {}
        }
      });
    }
    
    // 5. Intercept Clicks for In-Page Modal Overlay
    const overlay = document.getElementById('property-overlay');
    const iframe = document.getElementById('property-iframe');
    const closeBtn = document.getElementById('closeOverlayBtn');
    
    if (grid && overlay && iframe) {
      grid.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href && link.href.includes('property.html')) {
          e.preventDefault();
          try {
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('embedded', 'true');
            iframe.src = url.toString();
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
          } catch (navErr) {
            console.error('Failed to open property overlay:', navErr);
          }
        }
      });
    }
    
    if (closeBtn && overlay && iframe) {
      closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        iframe.src = 'about:blank';
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay && overlay.classList.contains('active')) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        if (iframe) iframe.src = 'about:blank';
      }
    });

  } catch (err) {
    console.error('Error loading matches:', err);
    if (headerContainer) {
      headerContainer.innerHTML = `
        <div class="match-header">
          <div class="match-header-badge" style="background:#fee2e2; color:#ef4444;"><i class="fas fa-exclamation-circle"></i> Notice</div>
          <h1>Collection Not Found</h1>
          <p>We couldn't load these matches. The link may have expired or is invalid.</p>
        </div>`;
    }
    if (grid) grid.innerHTML = '';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMatches);
} else {
  loadMatches();
}
