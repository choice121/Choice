import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  Check,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
} from 'lucide-react';
import { sampleProperties, type Property } from './data/sampleProperties';

const filters = ['All', 'House', 'Apartment', 'Townhome', 'Condo'];

type PropertyMediaItem = {
  kind?: 'photo' | 'floor_plan' | 'video' | 'virtual_tour';
  title?: string;
  url?: string;
};

type PropertyUnitItem = {
  id?: string;
  label?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  floor?: string;
  status?: 'Available' | 'Leased';
};

type PropertyRecord = {
  id: string;
  title: string;
  address: string;
  city: string;
  state: string;
  zip?: string;
  monthly_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  property_type?: string;
  property_kind?: string;
  description?: string;
  status?: string;
  landlords?: { business_name?: string; contact_name?: string } | null;
  property_photos?: Array<{ url?: string; display_order?: number; is_hero?: boolean }>;
  media?: PropertyMediaItem[] | Array<string | { url?: string; src?: string; href?: string; title?: string; kind?: string; type?: string; display_order?: number; is_hero?: boolean; }>;
  units?: PropertyUnitItem[];
  unit_options?: Array<Record<string, unknown>> | null;
  original_image_urls?: string[] | string | null;
  tour_url?: string;
  neighborhood?: string;
};

const normalizeType = (value?: string) => {
  const v = (value || '').toLowerCase();
  if (v.includes('town')) return 'Townhome';
  if (v.includes('apartment')) return 'Apartment';
  if (v.includes('condo')) return 'Condo';
  if (v.includes('duplex')) return 'House';
  return 'House';
};

const fallbackProperties = sampleProperties.map((property) => ({
  ...property,
  title: property.title,
  type: property.type,
  price: property.price,
  address: property.address,
  beds: property.beds,
  baths: property.baths,
  sqft: property.sqft,
  city: property.city,
  badge: property.badge,
  image: property.image,
  gallery: property.gallery,
  moveIn: property.moveIn,
  description: property.description,
  features: property.features,
}));

const getOptimizedImage = (url?: string, preset: 'card' | 'gallery' = 'card') => {
  if (!url) {
    return 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80';
  }

  if (typeof window !== 'undefined' && window.CONFIG && typeof window.CONFIG.img === 'function') {
    return window.CONFIG.img(url, preset);
  }

  return url;
};

const toMediaUrl = (candidate: unknown): string | null => {
  if (typeof candidate === 'string') return candidate || null;
  if (!candidate || typeof candidate !== 'object') return null;
  const value = candidate as Record<string, unknown>;
  return (typeof value.url === 'string' && value.url) || (typeof value.src === 'string' && value.src) || (typeof value.href === 'string' && value.href) || null;
};

const normalizeImportedMedia = (media: PropertyRecord['media']): PropertyMediaItem[] => {
  if (!Array.isArray(media)) return [];

  return media
    .map((entry) => {
      if (typeof entry === 'string') {
        return { kind: 'photo', title: 'Property photo', url: entry };
      }
      if (!entry || typeof entry !== 'object') return null;

      const src = toMediaUrl(entry);
      if (!src) return null;

      const kindValue = String((entry as Record<string, unknown>).kind ?? (entry as Record<string, unknown>).type ?? 'photo').toLowerCase();
      const kind: PropertyMediaItem['kind'] = /floor|plan/i.test(kindValue)
        ? 'floor_plan'
        : /tour|3d|matterport|virtual/i.test(kindValue)
          ? 'virtual_tour'
          : /video|mp4|youtube|vimeo/i.test(src)
            ? 'video'
            : 'photo';

      return {
        kind,
        title: typeof (entry as Record<string, unknown>).title === 'string' ? String((entry as Record<string, unknown>).title) : 'Property media',
        url: src,
      };
    })
    .filter((entry): entry is PropertyMediaItem => Boolean(entry));
};

const normalizeImportedUnits = (property: PropertyRecord): PropertyUnitItem[] => {
  const directUnits = Array.isArray(property.units) ? property.units : [];
  const importedOptions = Array.isArray(property.unit_options) ? property.unit_options : [];
  const units = [...directUnits, ...importedOptions.map((unit) => {
    const entry = (unit || {}) as Record<string, unknown>;
    const label = typeof entry.unit_number === 'string' && entry.unit_number ? entry.unit_number : (typeof entry.floor_plan_name === 'string' && entry.floor_plan_name ? entry.floor_plan_name : 'Available unit');
    const monthlyRent = Number(entry.monthly_rent ?? entry.starting_rent ?? property.monthly_rent ?? 0);
    const beds = Number(entry.bedrooms ?? entry.beds ?? property.bedrooms ?? 0);
    const baths = Number(entry.bathrooms ?? entry.baths ?? property.bathrooms ?? 0);
    const sqft = Number(entry.square_footage ?? entry.sqft ?? property.square_footage ?? 0);
    return {
      id: `${property.id}-unit-${label}`,
      label,
      price: monthlyRent,
      beds,
      baths,
      sqft,
      floor: typeof entry.floor === 'string' ? entry.floor : 'Main level',
      status: 'Available',
    } satisfies PropertyUnitItem;
  })];

  return units.map((unit) => ({
    id: unit.id || `${property.id}-unit-${Math.random().toString(16).slice(2, 6)}`,
    label: unit.label || 'Available unit',
    price: Number(unit.price || property.monthly_rent || 0),
    beds: Number(unit.beds || property.bedrooms || 0),
    baths: Number(unit.baths || property.bathrooms || 0),
    sqft: Number(unit.sqft || property.square_footage || 0),
    floor: unit.floor || 'Main level',
    status: unit.status || 'Available',
  }));
};

const toDisplayProperty = (property: PropertyRecord): Property => {
  const photoEntries = Array.isArray(property.property_photos) ? property.property_photos : [];
  const legacyUrls = photoEntries.map((photo) => photo.url).filter((url): url is string => Boolean(url));

  const parsedOriginalUrls = (() => {
    if (Array.isArray(property.original_image_urls)) return property.original_image_urls.filter((value): value is string => Boolean(value));
    if (typeof property.original_image_urls === 'string') {
      try {
        const parsed = JSON.parse(property.original_image_urls);
        if (Array.isArray(parsed)) return parsed.filter((value): value is string => typeof value === 'string' && Boolean(value));
      } catch {
        return [];
      }
    }
    return [];
  })();

  const allPhotoUrls = [...legacyUrls, ...parsedOriginalUrls, ...normalizeImportedMedia(property.media).map((media) => media.url)];
  const uniquePhotoUrls = Array.from(new Set(allPhotoUrls.filter(Boolean))) as string[];

  const image = photoEntries.find((photo) => photo.is_hero || photo.display_order === 0)?.url
    || uniquePhotoUrls[0]
    || 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80';

  const gallery = Array.from(new Set([image, ...uniquePhotoUrls])).slice(0, 6).map((url) => getOptimizedImage(url, 'gallery'));
  const address = property.address || `${property.city || 'Market'}, ${property.state || ''} ${property.zip || ''}`.trim();
  const title = property.title || `${address || property.city || 'Market'}, ${property.city || property.state || 'Market'}`;
  const media = normalizeImportedMedia(property.media).length
    ? normalizeImportedMedia(property.media)
    : gallery.map((url, index) => ({ kind: 'photo', title: index === 0 ? 'Hero view' : `View ${index + 1}`, url }));

  const propertyType = normalizeType(property.property_type || property.property_kind || property.title);

  return {
    id: property.id,
    title,
    address,
    city: property.city || 'Market',
    type: propertyType,
    propertyKind: propertyType === 'Apartment' ? 'Apartment Community' : propertyType === 'Townhome' ? 'Townhome' : propertyType === 'Condo' ? 'Condo' : 'Single Family',
    price: Number(property.monthly_rent || 0),
    beds: Number(property.bedrooms || 0),
    baths: Number(property.bathrooms || 0),
    sqft: Number(property.square_footage || 0),
    badge: property.landlords?.business_name ? 'Verified landlord' : 'Available now',
    image: getOptimizedImage(image, 'card'),
    gallery,
    media,
    units: normalizeImportedUnits(property),
    tourUrl: property.tour_url || undefined,
    neighborhood: property.neighborhood || property.city || 'Neighborhood',
    moveIn: property.status === 'active' ? 'Available now' : 'Soon',
    description: property.description || 'A well-appointed home with modern finishes and a comfortable layout.',
    features: ['Updated interiors', 'Flexible move-in', 'Well-located', 'Convenient access'],
  };
};

const formatMoney = (value: number) => `$${value.toLocaleString()}`;

function usePropertyData() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PropertyRecord[]>([]);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        const cfg = window.CONFIG;
        const client = window.supabase && cfg
          ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
              auth: { persistSession: false, autoRefreshToken: false },
            })
          : null;

        if (!client) {
          if (!ignore) {
            setRecords([]);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await client
          .from('properties')
          .select('id,title,address,city,state,zip,monthly_rent,bedrooms,bathrooms,square_footage,property_type,property_kind,status,description,tour_url,neighborhood,media,unit_options,units,created_at,landlords(business_name,contact_name),property_photos(url,display_order,is_hero),original_image_urls')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(24);

        if (!ignore) {
          setRecords(error || !data || !data.length ? [] : (data as PropertyRecord[]));
          setLoading(false);
        }
      } catch {
        if (!ignore) {
          setRecords([]);
          setLoading(false);
        }
      }
    };

    load();
    return () => { ignore = true; };
  }, []);

  return { loading, records };
}

function getDisplayProperties(records: PropertyRecord[], query = '', selectedFilter = 'All', selectedCity = 'All') {
  const source = records.length ? records : fallbackProperties.map((property) => ({
    id: property.id,
    title: property.title,
    address: property.address,
    city: property.city,
    state: 'TX',
    monthly_rent: property.price,
    bedrooms: property.beds,
    bathrooms: property.baths,
    square_footage: property.sqft,
    property_type: property.type,
    status: 'active',
    description: property.description,
    landlords: null,
    property_photos: [{ url: property.image, display_order: 0, is_hero: true }],
  }));

  return source
    .map(toDisplayProperty)
    .filter((property) => {
      const matchesFilter = selectedFilter === 'All' || property.type === selectedFilter;
      const matchesCity = selectedCity === 'All' || property.city === selectedCity;
      const haystack = `${property.title} ${property.city} ${property.address} ${property.type}`.toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());
      return matchesFilter && matchesCity && matchesQuery;
    });
}

function HomePage() {
  const { loading, records } = usePropertyData();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const displayProperties = useMemo(() => getDisplayProperties(records, query), [records, query]);

  const featured = displayProperties.slice(0, 4);
  const totalHomes = records.length || displayProperties.length || 1250;
  const marketTiles = [
    { city: 'Austin', label: 'Luxury homes', detail: 'From $2,400/mo', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?...' },
    { city: 'Seattle', label: 'Urban living', detail: 'From $2,100/mo', image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?...' },
    { city: 'Dallas', label: 'Modern spaces', detail: 'From $1,950/mo', image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?...' },
  ];

  const handleSearch = () => {
    const next = query.trim();
    navigate(`/listings${next ? `?q=${encodeURIComponent(next)}` : ''}`);
  };

  return (
    <>
      <section className="zillow-hero">
        <div className="zillow-hero-inner">
          <div className="zillow-hero-copy">
            <div className="hero-topline">
              <span className="zillow-mini-badge">Zillow-style rentals</span>
              <span className="zillow-mini-badge muted-badge">Verified listings</span>
            </div>
            <h1>Find a place to call home.</h1>
            <p>
              Search verified rentals, compare neighborhoods, and move from browsing to application with a market experience built around clarity and speed.
            </p>

            <div className="zillow-search" role="search">
              <Search size={18} color="#475467" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSearch();
                }}
                placeholder="Search by city, address, or ZIP"
                aria-label="Search listings"
              />
              <button className="primary-btn" onClick={handleSearch}>Search</button>
            </div>

            <div className="zillow-quick-links">
              <button type="button" onClick={() => navigate('/listings')}>Homes for rent</button>
              <button type="button" onClick={() => navigate('/listings?')}>Apartments</button>
              <button type="button" onClick={() => navigate('/listings?q=Townhome')}>Townhomes</button>
              <button type="button" onClick={() => navigate('/listings?q=Apartment')}>Luxury rentals</button>
            </div>

            <div className="zillow-browse-row">
              <button type="button" className="browse-pill active">For rent</button>
              <button type="button" className="browse-pill">Open houses</button>
              <button type="button" className="browse-pill">Neighborhoods</button>
              <button type="button" className="browse-pill">Price drops</button>
            </div>

            <div className="zillow-micro-strip">
              <span>Median rent: $2,345</span>
              <span>Open houses today</span>
              <span>New inventory: 184</span>
            </div>

            <div className="zillow-stats">
              <div><strong>{totalHomes}</strong><span>Active listings</span></div>
              <div><strong>24/7</strong><span>Fast search</span></div>
              <div><strong>$2.3k</strong><span>Avg. rent</span></div>
            </div>
          </div>

          <div className="zillow-hero-visual">
            <div className="zillow-photo-card">
              <img src="https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80" alt="Featured rental home" />
              <div className="zillow-photo-badge">Verified homes</div>
            </div>
          </div>
        </div>
      </section>

      <section className="zillow-section">
        <div className="section-head modern-head">
          <div>
            <div className="eyebrow dark"><Sparkles size={14} /> Explore</div>
            <h2>Popular neighborhoods</h2>
          </div>
          <button className="text-link" onClick={() => navigate('/listings')}>See all homes</button>
        </div>

        <div className="market-grid">
          {marketTiles.map((market) => (
            <button key={market.city} type="button" className="market-card" onClick={() => navigate(`/listings?q=${encodeURIComponent(market.city)}`)}>
              <img src={market.image} alt={market.city} />
              <div className="market-copy">
                <span>{market.city}</span>
                <strong>{market.label}</strong>
                <em>{market.detail}</em>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="zillow-section">
        <div className="section-head modern-head">
          <div>
            <div className="eyebrow dark"><Star size={14} /> Featured</div>
            <h2>New listings</h2>
          </div>
          <button className="text-link" onClick={() => navigate('/listings')}>View all</button>
        </div>

        <div className="listing-grid-home">
          {featured.map((property) => (
            <article key={property.id} className="zillow-card">
              <div className="card-media">
                <img src={property.image} alt={property.title} />
                <button className="heart-btn" aria-label={`Save ${property.title}`}>
                  <Heart size={16} color="#475467" />
                </button>
              </div>
              <div className="card-body">
                <div className="price-row">
                  <div className="price">{formatMoney(property.price)} <small>/mo</small></div>
                  <span className="card-badge">{property.type}</span>
                </div>
                <div className="address">{property.address}</div>
                <div className="meta-row">
                  <span className="meta-pill"><BedDouble size={14} /> {property.beds} bd</span>
                  <span className="meta-pill"><Bath size={14} /> {property.baths} ba</span>
                  <span className="meta-pill"><Square size={14} /> {property.sqft.toLocaleString()} sqft</span>
                </div>
                <div className="card-actions zillow-actions">
                  <button className="ghost-btn" onClick={() => navigate(`/property/${property.id}`)}>View details</button>
                  <button className="primary-btn" onClick={() => navigate('/apply')}>Apply now</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="zillow-section">
        <div className="bottom-panel-card no-scroll-panel market-insights-card">
          <div className="eyebrow dark"><MapPin size={14} /> Market snapshot</div>
          <div className="insight-grid">
            <div className="insight-stat">
              <strong>18.2%</strong>
              <span>Average drop vs last quarter</span>
            </div>
            <div className="insight-stat">
              <strong>2.4k</strong>
              <span>Median asking rent</span>
            </div>
            <div className="insight-stat">
              <strong>184</strong>
              <span>Fresh listings this week</span>
            </div>
          </div>

          <div className="insight-rail">
            {['Downtown', 'North Loop', 'West Loop', 'Hillside', 'Riverside'].map((item) => (
              <button key={item} type="button" className="insight-pill" onClick={() => navigate(`/listings?q=${encodeURIComponent(item)}`)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="zillow-section">
        <div className="bottom-panel-card no-scroll-panel">
          <div className="eyebrow dark"><ShieldCheck size={14} /> Why renters choose us</div>
          <div className="panel-grid">
            <div>
              <h3>Transparent listings</h3>
              <p>Every property is presented with clear pricing and details, so you can compare homes quickly and confidently.</p>
            </div>
            <div>
              <h3>Fast move-ins</h3>
              <p>Search by neighborhood, filter by budget, and move from shortlist to application in a few taps.</p>
            </div>
            <div>
              <h3>Guided application</h3>
              <p>Complete your rental application in a focused path built to reduce friction and speed up approvals.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ListingsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedCity, setSelectedCity] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [sortBy, setSortBy] = useState('Newest');
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { loading, records } = usePropertyData();

  const displayProperties = useMemo(() => {
    const filtered = getDisplayProperties(records, query, selectedFilter, selectedCity);
    const sorted = [...filtered];

    if (sortBy === 'Price: Low to high') {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'Price: High to low') {
      sorted.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'Beds: Most') {
      sorted.sort((a, b) => (b.beds || 0) - (a.beds || 0));
    }

    return sorted;
  }, [records, query, selectedFilter, selectedCity, sortBy]);

  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    const source = records.length ? records : fallbackProperties.map((property) => ({
      id: property.id,
      city: property.city,
      property_type: property.type,
      monthly_rent: property.price,
      bedrooms: property.beds,
      bathrooms: property.baths,
      square_footage: property.sqft,
      status: 'active',
      address: property.address,
      title: property.title,
      description: property.description,
      property_photos: [{ url: property.image, display_order: 0, is_hero: true }],
    }));

    source.forEach((property) => {
      if (property.city) cities.add(property.city);
    });

    return ['All', ...Array.from(cities).slice(0, 8)];
  }, [records]);

  const quickFilters = [
    { label: 'Move-in ready', value: 'move in' },
    { label: 'Budget $2k', value: '2000' },
    { label: 'Pet friendly', value: 'pet' },
    { label: 'Luxury', value: 'luxury' },
  ];

  return (
    <>
      <section className="zillow-listings-header">
        <div>
          <div className="eyebrow dark"><SlidersHorizontal size={14} /> Home for rent</div>
          <h2>{displayProperties.length} homes in {selectedCity === 'All' ? 'your area' : selectedCity}</h2>
        </div>
        <div className="zillow-toolbar-right">
          <div className="view-switch" aria-label="View mode selector">
            <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>List</button>
            <button type="button" className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>Map</button>
          </div>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort listings">
            <option>Newest</option>
            <option>Price: Low to high</option>
            <option>Price: High to low</option>
            <option>Beds: Most</option>
          </select>
          <button className="primary-btn" onClick={() => navigate('/apply')}>Apply now</button>
        </div>
      </section>

      <div className="listing-quick-filters">
        {quickFilters.map((filter) => (
          <button
            key={filter.label}
            type="button"
            className="quick-filter-pill"
            onClick={() => navigate(`/listings?q=${encodeURIComponent(filter.value)}`)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <section className="zillow-listings-shell">
        <aside className="zillow-sidebar">
          <div className="zillow-sidebar-section">
            <h3>Price & home type</h3>
            <div className="filter-stack">
              {filters.map((filter) => (
                <button
                  key={filter}
                  className={`chip ${selectedFilter === filter ? 'active' : ''}`}
                  onClick={() => setSelectedFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="zillow-sidebar-section">
            <h3>Cities</h3>
            <div className="filter-stack compact-stack">
              {cityOptions.map((city) => (
                <button
                  key={city}
                  className={`chip ${selectedCity === city ? 'active' : ''}`}
                  onClick={() => setSelectedCity(city)}
                >
                  {city}
                </button>
              ))}
            </div>
          </div>

          <div className="zillow-sidebar-section sidebar-metric">
            <span>{displayProperties.length}</span>
            <small>Matching homes</small>
          </div>
        </aside>

        <div className="zillow-main-column">
          {viewMode === 'map' && (
            <div className="zillow-map-card">
              <div className="map-overlay">
                <strong>Map view</strong>
                <span>{selectedCity === 'All' ? 'Browse by neighborhood' : selectedCity}</span>
              </div>
            </div>
          )}

          <div className="results-summary-row">
            <span>Showing {displayProperties.length} homes</span>
            <span>{selectedCity === 'All' ? 'Across nearby cities' : selectedCity}</span>
          </div>

          <div className="zillow-results-grid">
            {loading ? (
              <div className="no-results">Loading listings…</div>
            ) : displayProperties.length ? (
              displayProperties.map((property) => (
                <article key={property.id} className="zillow-card row-card" onClick={() => navigate(`/property/${property.id}`)}>
                  <div className="card-media">
                    <img src={property.image} alt={property.title} />
                    <button
                      className="heart-btn"
                      aria-label={`Save ${property.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSaved((prev) => ({ ...prev, [property.id]: !prev[property.id] }));
                      }}
                    >
                      <Heart size={16} fill={saved[property.id] ? '#f59e0b' : 'none'} color={saved[property.id] ? '#f59e0b' : '#475467'} />
                    </button>
                  </div>
                  <div className="card-body">
                    <div className="price-row">
                      <div className="price">{formatMoney(property.price)} <small>/mo</small></div>
                      <span className="card-badge">{property.badge}</span>
                    </div>
                    <div className="address">{property.address}</div>
                    <div className="meta-row">
                      <span className="meta-pill"><BedDouble size={14} /> {property.beds} bd</span>
                      <span className="meta-pill"><Bath size={14} /> {property.baths} ba</span>
                      <span className="meta-pill"><Square size={14} /> {property.sqft.toLocaleString()} sqft</span>
                    </div>
                    <div className="row-footer">
                      <span>{property.city}</span>
                      <button className="text-link">View details</button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="no-results full-span">No homes match the current search. Try another city or filter.</div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function PropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { records, loading } = usePropertyData();
  const [imageIndex, setImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'gallery' | 'units' | 'tour'>('overview');

  const property = useMemo(() => {
    const source = records.length ? records : fallbackProperties.map((item) => ({
      id: item.id,
      title: item.title,
      address: item.address,
      city: item.city,
      state: 'TX',
      monthly_rent: item.price,
      bedrooms: item.beds,
      bathrooms: item.baths,
      square_footage: item.sqft,
      property_type: item.type,
      status: 'active',
      description: item.description,
      landlords: null,
      property_photos: [{ url: item.image, display_order: 0, is_hero: true }, ...item.gallery.map((url) => ({ url, display_order: 1, is_hero: false }))],
    }));

    const mapped = source.map(toDisplayProperty);
    return mapped.find((item) => item.id === id) || mapped[0] || fallbackProperties[0];
  }, [id, records]);

  useEffect(() => {
    setImageIndex(0);
  }, [id]);

  if (loading && !property) {
    return <div className="section no-results">Loading property…</div>;
  }

  const mediaPanels = property.media && property.media.length ? property.media : [{ kind: 'photo', title: 'Hero view', url: property.image }];
  const unitCards = property.units && property.units.length ? property.units : [];
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'gallery', label: 'Gallery' },
    { key: 'units', label: `Units (${unitCards.length})` },
    { key: 'tour', label: 'Tour' },
  ] as const;

  const nearbyHomes = useMemo(() => {
    const source = records.length ? records : fallbackProperties.map((item) => ({
      id: item.id,
      title: item.title,
      address: item.address,
      city: item.city,
      state: 'TX',
      monthly_rent: item.price,
      bedrooms: item.beds,
      bathrooms: item.baths,
      square_footage: item.sqft,
      property_type: item.type,
      status: 'active',
      description: item.description,
      landlords: null,
      property_photos: [{ url: item.image, display_order: 0, is_hero: true }],
    }));

    return source
      .filter((item) => item.id !== property.id && item.city === property.city)
      .slice(0, 3)
      .map(toDisplayProperty);
  }, [records, property.city, property.id]);

  return (
    <>
      <section className="property-hero-shell">
        <div className="property-hero-gallery">
          <div className="hero-image-wrap">
            <img src={mediaPanels[imageIndex]?.url || property.gallery[imageIndex] || property.image} alt={property.title} />
          </div>
          <div className="thumb-row">
            {mediaPanels.map((mediaItem, index) => (
              <button
                key={`${property.id}-${index}`}
                className={`thumb ${index === imageIndex ? 'active' : ''}`}
                onClick={() => setImageIndex(index)}
              >
                <img src={mediaItem.url || property.image} alt={`${property.title} ${mediaItem.title || 'media'} ${index + 1}`} />
              </button>
            ))}
          </div>
        </div>

        <aside className="property-summary-card">
          <div className="summary-topline">
            <span className="card-badge">{property.type}</span>
            <button className="heart-btn" aria-label={`Save ${property.title}`}>
              <Heart size={16} color="#475467" />
            </button>
          </div>
          <div className="summary-price">{formatMoney(property.price)} <small>/mo</small></div>
          <div className="summary-address"><MapPin size={16} /> {property.address}</div>
          <div className="summary-meta-grid">
            <div><small>Beds</small><strong>{property.beds}</strong></div>
            <div><small>Baths</small><strong>{property.baths}</strong></div>
            <div><small>Sqft</small><strong>{property.sqft.toLocaleString()}</strong></div>
            <div><small>Move-in</small><strong>{property.moveIn}</strong></div>
          </div>
          <div className="summary-bullet-list">
            <div><span>Tour available</span><strong>Virtual + in-person</strong></div>
            <div><span>School district</span><strong>Top-rated nearby</strong></div>
            <div><span>Avg. rent</span><strong>{formatMoney(Math.max(property.price - 140, 1100))}</strong></div>
          </div>

          <div className="summary-actions">
            <button className="primary-btn" onClick={() => navigate('/apply')}>Apply now</button>
            <button className="secondary-btn" onClick={() => navigate('/listings')}>Back to homes</button>
          </div>
        </aside>
      </section>

      <section className="property-details-layout">
        <div className="property-main-panel">
          <div className="section-head compact-head">
            <h2>{property.title}</h2>
          </div>

          <div className="detail-tab-row" role="tablist" aria-label="Property detail sections">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`detail-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="facts-bar">
            <span><BedDouble size={14} /> {property.beds} beds</span>
            <span><Bath size={14} /> {property.baths} baths</span>
            <span><Square size={14} /> {property.sqft.toLocaleString()} sqft</span>
            <span><Building2 size={14} /> {property.type}</span>
          </div>

          {activeTab === 'overview' && (
            <>
              <div className="detail-copy-block">
                <h3>About this home</h3>
                <p>{property.description}</p>
              </div>

              <div className="detail-copy-block">
                <h3>Highlights</h3>
                <div className="meta-row">
                  {property.features.map((feature) => (
                    <span key={feature} className="meta-pill"><Star size={12} /> {feature}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'gallery' && (
            <div className="detail-copy-block">
              <h3>Photo gallery</h3>
              <div className="gallery-grid">
                {mediaPanels.map((item, index) => (
                  <button key={`${property.id}-gallery-${index}`} type="button" className="gallery-tile" onClick={() => setImageIndex(index)}>
                    <img src={item.url || property.image} alt={item.title || property.title} />
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'units' && (
            unitCards.length > 0 ? (
              <div className="detail-copy-block">
                <h3>Available units</h3>
                <div className="unit-grid">
                  {unitCards.map((unit) => (
                    <div key={unit.id} className="unit-card">
                      <div className="unit-header-row">
                        <strong>{unit.label}</strong>
                        <span>{unit.status}</span>
                      </div>
                      <div className="unit-metrics">
                        <span>{unit.beds} bd</span>
                        <span>{unit.baths} ba</span>
                        <span>{unit.sqft.toLocaleString()} sqft</span>
                        <span>{unit.floor}</span>
                      </div>
                      <div className="unit-footer-row">
                        <div className="unit-price">{formatMoney(unit.price || property.price)} <small>/mo</small></div>
                        <button className="primary-btn small-btn" onClick={() => navigate('/apply')}>Apply</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="detail-copy-block">
                <h3>Available units</h3>
                <p>No unit inventory is available for this listing yet.</p>
              </div>
            )
          )}

          {activeTab === 'tour' && (
            <div className="detail-copy-block">
              <h3>Tour & media</h3>
              <div className="media-strip">
                {mediaPanels.map((item) => (
                  <div key={`${property.id}-${item.title}`} className="media-chip">{item.title}</div>
                ))}
                {property.tourUrl && <a className="tour-link" href={property.tourUrl} target="_blank" rel="noreferrer">Open 3D tour</a>}
              </div>
            </div>
          )}

          {nearbyHomes.length > 0 && (
            <div className="detail-copy-block similar-homes-block">
              <h3>Similar homes nearby</h3>
              <div className="similar-homes-grid">
                {nearbyHomes.map((nearby) => (
                  <button key={nearby.id} type="button" className="similar-home-card" onClick={() => navigate(`/property/${nearby.id}`)}>
                    <img src={nearby.image} alt={nearby.title} />
                    <div className="similar-home-copy">
                      <strong>{formatMoney(nearby.price)}</strong>
                      <span>{nearby.address}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="property-side-panel">
          <h3>Neighborhood snapshot</h3>
          <ul>
            <li>{property.neighborhood || property.city}</li>
            <li>Walkable streets and everyday convenience</li>
            <li>Popular with renters seeking flexible move-ins</li>
            <li>Quick access to dining, schools, and transit</li>
          </ul>

          <div className="mini-cta-card">
            <span>Hot in {property.city}</span>
            <strong>{nearbyHomes.length > 0 ? `${nearbyHomes.length + 1} nearby options` : 'Fresh inventory'}</strong>
            <button className="primary-btn small-btn" onClick={() => navigate('/listings')}>Browse more</button>
          </div>
        </aside>
      </section>
    </>
  );
}

function ApplyPage() {
  return (
    <section className="section page-panel apply-panel">
      <div className="apply-card">
        <div className="eyebrow dark"><ShieldCheck size={14} /> Secure application</div>
        <h2>Ready to apply?</h2>
        <p>Continue to the application flow and complete your screening information in a simple, guided experience.</p>
        <ul className="check-list">
          <li><Check size={16} /> Personal details and income verification</li>
          <li><Check size={16} /> Household and co-applicant setup</li>
          <li><Check size={16} /> Documents and confirmation</li>
        </ul>
        <button className="primary-btn" onClick={() => window.alert('This local preview is wired to the public application flow, and the live backend remains isolated until final deployment approval.')}>Start application</button>
      </div>
    </section>
  );
}

function ReviewPage() {
  const { records, loading } = usePropertyData();
  const [items, setItems] = useState<Array<{
    id: string;
    title: string;
    city: string;
    price: number;
    score: number;
    photos: number;
    status: 'ready' | 'needs-review' | 'rejected';
    checks: { label: string; ok: boolean; detail: string }[];
    issues: string[];
  }>>([]);

  const reviewSeed = useMemo(() => {
    const source = records.length ? records : fallbackProperties.map((property) => ({
      id: property.id,
      title: property.title,
      city: property.city,
      monthly_rent: property.price,
      bedrooms: property.beds,
      bathrooms: property.baths,
      square_footage: property.sqft,
      property_type: property.type,
      status: 'active',
      description: property.description,
      landlords: null,
      property_photos: [{ url: property.image, display_order: 0, is_hero: true }],
    }));

    return source.slice(0, 6).map((property, index) => {
      const description = String(property.description || '');
      const photoCount = Array.isArray(property.property_photos) ? property.property_photos.length : 0;
      const checks = [
        { label: 'Address present', ok: Boolean(property.address), detail: property.address || 'Missing address' },
        { label: 'City present', ok: Boolean(property.city), detail: property.city || 'Missing city' },
        { label: 'Rent is valid', ok: Number(property.monthly_rent || 0) > 0, detail: property.monthly_rent ? `$${Number(property.monthly_rent).toLocaleString()}` : 'Rent missing' },
        { label: 'Bedroom / bath data', ok: Number(property.bedrooms || 0) > 0 && Number(property.bathrooms || 0) > 0, detail: `${property.bedrooms || 0} bd • ${property.bathrooms || 0} ba` },
        { label: 'Photo quality check', ok: photoCount >= 6, detail: `${photoCount} photos collected` },
        { label: 'Lease prohibition check', ok: !/\b(?:\d+\s*month|lease\s*term|minimum\s*lease)\b/i.test(description), detail: 'No lease term language' },
        { label: 'Smoking policy check', ok: !/smoking|smoke/i.test(description), detail: 'No smoking policy text' },
        { label: 'Move-in date check', ok: !/move[- ]?in|available from|available date/i.test(description), detail: 'No move-in/availability language' },
      ];

      const failedChecks = checks.filter((check) => !check.ok);
      const score = Math.max(0, Math.min(100, 100 - failedChecks.length * 12 + (photoCount >= 6 ? 8 : 0)));
      const issues = failedChecks.map((check) => check.label);

      return {
        id: property.id,
        title: property.title || 'Untitled listing',
        city: property.city || 'Undesignated city',
        price: Number(property.monthly_rent || 0),
        score,
        photos: photoCount,
        status: failedChecks.length > 2 ? 'needs-review' : 'ready',
        checks,
        issues: issues.length ? issues.slice(0, 3) : ['No blocking issues'],
      };
    });
  }, [records]);

  useEffect(() => {
    setItems(reviewSeed);
  }, [reviewSeed]);

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const reviewCount = items.filter((item) => item.status === 'needs-review').length;

  const updateStatus = (id: string, status: 'ready' | 'needs-review' | 'rejected') => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  };

  return (
    <section className="section review-shell">
      <div className="review-header">
        <div>
          <div className="eyebrow dark"><ShieldCheck size={14} /> Import review</div>
          <h2>Listing QA and publish review</h2>
        </div>
        <button className="primary-btn" onClick={() => window.alert('Local preview publish queue is active; no production deployment is being triggered.')}>Publish queue</button>
      </div>

      <div className="review-metrics">
        <div className="metric-card">
          <span className="metric-label">Ready</span>
          <strong>{readyCount}</strong>
        </div>
        <div className="metric-card warn">
          <span className="metric-label">Needs review</span>
          <strong>{reviewCount}</strong>
        </div>
        <div className="metric-card neutral">
          <span className="metric-label">Avg. score</span>
          <strong>{items.length ? Math.round(items.reduce((total, item) => total + item.score, 0) / items.length) : 0}</strong>
        </div>
      </div>

      {loading ? (
        <div className="no-results">Loading review queue…</div>
      ) : (
        <div className="review-grid">
          {items.map((item) => (
            <article key={item.id} className="review-card">
              <div className="review-card-topline">
                <div>
                  <span className="card-badge">{item.city}</span>
                </div>
                <span className={`status-pill ${item.status}`}>
                  {item.status === 'ready' ? 'Ready' : item.status === 'needs-review' ? 'Needs review' : 'Rejected'}
                </span>
              </div>

              <h3>{item.title}</h3>
              <div className="review-price">{formatMoney(item.price)} <small>/mo</small></div>

              <div className="review-facts">
                <span>Photos: {item.photos}</span>
                <span>Score: {item.score}</span>
              </div>

              <div className="issue-list">
                {item.issues.length ? item.issues.map((issue) => <span key={issue}>{issue}</span>) : <span>All required checks pass.</span>}
              </div>

              <div className="quality-checklist">
                {item.checks.map((check) => (
                  <div key={`${item.id}-${check.label}`} className={`quality-row ${check.ok ? 'ok' : 'warn'}`}>
                    <span className="quality-dot">{check.ok ? '✓' : '!'}</span>
                    <div>
                      <strong>{check.label}</strong>
                      <small>{check.detail}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className="review-actions">
                <button className="ghost-btn" onClick={() => updateStatus(item.id, 'needs-review')}>Flag</button>
                <button className="secondary-btn" onClick={() => updateStatus(item.id, 'rejected')}>Reject</button>
                <button className="primary-btn" onClick={() => updateStatus(item.id, 'ready')}>Approve</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InfoPage({ title, body }: { title: string; body: string[] }) {
  return (
    <section className="section page-panel">
      <div className="info-card">
        <div className="eyebrow dark"><Building2 size={14} /> Choice experience</div>
        <h2>{title}</h2>
        {body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

function AppLayout() {
  const location = useLocation();
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');

  const routeContent = (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/listings" element={<ListingsPage />} />
      <Route path="/property/:id" element={<PropertyPage />} />
      <Route path="/apply" element={<ApplyPage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/how-it-works" element={<InfoPage title="How it works" body={['Browse verified rentals, review detail pages, and apply in a guided flow designed to reduce friction and keep the experience transparent.', 'Every screen is built to feel like a live marketplace with a clear browse-to-apply journey.']} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  return (
    <div className={`app-shell ${deviceMode === 'mobile' ? 'is-mobile-preview' : 'is-desktop-preview'}`}>
      <header className="site-header">
        <div className="topbar">
          <div className="brand" aria-label="Choice Properties home">
            <div className="brand-mark">
              <Building2 size={18} />
            </div>
            <div className="brand-copy">
              <strong>Choice Properties</strong>
              <span>Rental marketplace</span>
            </div>
          </div>

          <div className="header-actions" aria-label="Main navigation and preview controls">
            <nav className="nav-group zillow-nav" aria-label="Main navigation">
              <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/">Buy</NavLink>
              <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/listings">Rent</NavLink>
              <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/review">Review</NavLink>
              <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/how-it-works">Sell</NavLink>
              <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/apply">Home loans</NavLink>
              <NavLink className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`} to="/apply">Agent finder</NavLink>
            </nav>

            <button className="ghost-btn header-menu">Menu</button>

            <div className="preview-toggle" aria-label="Preview mode selector">
              <button
                type="button"
                className={`toggle-btn ${deviceMode === 'desktop' ? 'active' : ''}`}
                onClick={() => setDeviceMode('desktop')}
              >
                Desktop
              </button>
              <button
                type="button"
                className={`toggle-btn ${deviceMode === 'mobile' ? 'active' : ''}`}
                onClick={() => setDeviceMode('mobile')}
              >
                Mobile
              </button>
            </div>

            <button className="secondary-btn header-cta" onClick={() => window.alert('This is the local preview environment — no production account flow is being altered.')}>Sign in</button>
            <button className="primary-btn header-cta" onClick={() => window.location.assign('/apply')}>Apply now</button>
          </div>
        </div>
      </header>

      <main className={`main ${deviceMode === 'mobile' ? 'mobile-preview-shell' : ''}`}>
        {deviceMode === 'mobile' ? (
          <div className="device-frame" aria-label="Mobile preview frame">
            <div className="device-notch" />
            <div className="device-screen">
              {routeContent}
            </div>
          </div>
        ) : (
          routeContent
        )}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <strong>Choice Properties</strong>
            <span>Local marketplace preview</span>
          </div>
          <div className="footer-links">
            <span>{location.pathname === '/' ? 'Home' : location.pathname.replace('/', '') || 'Home'}</span>
            <span>Browse rentals</span>
            <span>Apply now</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
