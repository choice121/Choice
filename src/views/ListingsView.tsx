import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  SlidersHorizontal, 
  X, 
  Bed, 
  Bath, 
  DollarSign, 
  RotateCcw, 
  Grid, 
  MapPin, 
  ChevronDown,
  ShieldCheck,
  Check
} from 'lucide-react';
import type { Property } from '../types';
import { getProperties } from '../lib/supabase';
import { PropertyCard } from '../components/property/PropertyCard';
import { useLanguage } from '../context/LanguageContext';

interface ListingsViewProps {
  initialSearch?: string;
  onSelectProperty: (id: string) => void;
  onApply: (id: string) => void;
}

export const ListingsView: React.FC<ListingsViewProps> = ({
  initialSearch = '',
  onSelectProperty,
  onApply,
}) => {
  const { t } = useLanguage();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters State
  const [search, setSearch] = useState(initialSearch);
  const [city, setCity] = useState('all');
  const [minPrice, setMinPrice] = useState<number | ''>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');
  const [beds, setBeds] = useState('all');
  const [baths, setBaths] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'beds'>('newest');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Available Cities
  const cities = [
    'all',
    'Columbus',
    'Fort Worth',
    'Kansas City',
    'Dallas',
    'Indianapolis',
    'Charlotte',
    'Atlanta',
    'Houston',
    'Memphis',
    'Oklahoma City',
    'Tulsa',
    'Belleville',
    'St. Louis',
  ];

  const fetchFilteredProperties = async () => {
    setLoading(true);
    const res = await getProperties({
      search: search || undefined,
      city: city !== 'all' ? city : undefined,
      minPrice: minPrice !== '' ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== '' ? Number(maxPrice) : undefined,
      beds: beds !== 'all' ? beds : undefined,
      baths: baths !== 'all' ? baths : undefined,
      sortBy,
      limit: 60,
    });

    if (res.data) {
      setProperties(res.data);
      setTotalCount(res.count);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFilteredProperties();
  }, [city, minPrice, maxPrice, beds, baths, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFilteredProperties();
  };

  const handleResetFilters = () => {
    setSearch('');
    setCity('all');
    setMinPrice('');
    setMaxPrice('');
    setBeds('all');
    setBaths('all');
    setSortBy('newest');
  };

  const hasActiveFilters =
    search !== '' ||
    city !== 'all' ||
    minPrice !== '' ||
    maxPrice !== '' ||
    beds !== 'all' ||
    baths !== 'all';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Browse Rental Listings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Showing {properties.length} of {totalCount.toLocaleString()} verified available properties
          </p>
        </div>

        {/* Sort & Mobile Filter Toggle */}
        <div className="flex items-center gap-2">
          {/* Mobile filter button */}
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="md:hidden flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs"
          >
            <Filter className="w-4 h-4 text-blue-600" />
            <span>Filters {hasActiveFilters && '(Active)'}</span>
          </button>

          {/* Sort selector */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="appearance-none px-3.5 py-2.5 pr-8 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
            >
              <option value="newest">Newest Listed</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="beds">Most Bedrooms</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Desktop Quick Filter Bar */}
      <div className="hidden md:block p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by address, city, neighborhood, or zip..."
              className="w-full pl-10 pr-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* City filter */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Market:</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="px-3 py-1.5 rounded-lg font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Nationwide' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Beds filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500">Beds:</span>
            {['all', '1', '2', '3', '4'].map((b) => (
              <button
                key={b}
                onClick={() => setBeds(b)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  beds === b
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {b === 'all' ? 'Any' : `${b}+`}
              </button>
            ))}
          </div>

          {/* Price Filters */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Max Rent:</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
              placeholder="e.g. 2000"
              className="w-24 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Filters Bottom Sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-slate-950 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto p-6 space-y-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Filter Listings</h3>
              </div>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* City Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">City / Market</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c === 'all' ? 'All Nationwide' : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Bedrooms Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Bedrooms</label>
              <div className="grid grid-cols-5 gap-2">
                {['all', '1', '2', '3', '4'].map((b) => (
                  <button
                    key={b}
                    onClick={() => setBeds(b)}
                    className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                      beds === b
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {b === 'all' ? 'Any' : `${b}+ Bed`}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Price Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Max Monthly Rent ($)</label>
              <input
                type="number"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 1800"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex-1 py-3 rounded-xl font-semibold text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900"
              >
                Reset All
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="flex-2 py-3 rounded-xl font-bold text-xs bg-blue-600 text-white shadow-md"
              >
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Listings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className="h-80 rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse"
            />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No listings match your search criteria</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            Try adjusting your price range or city filter to see more available properties.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-md hover:bg-blue-700"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onSelect={(id) => onSelectProperty(id)}
              onApply={(id) => onApply(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
