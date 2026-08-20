import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  PawPrint, 
  DollarSign, 
  ArrowRight, 
  Sparkles, 
  Building, 
  ChevronRight,
  Clock,
  Lock,
  Layers,
  Filter
} from 'lucide-react';
import type { Property } from '../types';
import { getProperties } from '../lib/supabase';
import { PropertyCard } from '../components/property/PropertyCard';
import { useLanguage } from '../context/LanguageContext';

interface HomeViewProps {
  onNavigate: (view: string, param?: string) => void;
  onSelectProperty: (id: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate, onSelectProperty }) => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBed, setSelectedBed] = useState('all');
  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [totalCount, setTotalCount] = useState(2495);
  const [loading, setLoading] = useState(true);

  const topCities = [
    { name: 'Columbus, OH', query: 'Columbus' },
    { name: 'Fort Worth, TX', query: 'Fort Worth' },
    { name: 'Kansas City, MO', query: 'Kansas City' },
    { name: 'Dallas, TX', query: 'Dallas' },
    { name: 'Indianapolis, IN', query: 'Indianapolis' },
    { name: 'Charlotte, NC', query: 'Charlotte' },
    { name: 'Atlanta, GA', query: 'Atlanta' },
    { name: 'Houston, TX', query: 'Houston' },
  ];

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const res = await getProperties({ limit: 6 });
      if (res.data) {
        setFeaturedProperties(res.data);
        if (res.count) setTotalCount(res.count);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('listings', searchQuery);
  };

  return (
    <div className="space-y-12 sm:space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900 text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-slate-800">
        {/* Ambient background decoration */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-600/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center space-y-6 sm:space-y-8">
          {/* Real-time verified count pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{totalCount.toLocaleString()}+ Verified Rental Listings Active Nationwide</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Find Your Next Home <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-200">
              Nationwide, With Ease.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-300 leading-relaxed">
            Browse verified houses, apartments, and condos. Always pet-friendly, standard $50 application fees, and secure online lease processing.
          </p>

          {/* Search Box */}
          <form
            onSubmit={handleSearch}
            className="max-w-3xl mx-auto bg-white dark:bg-slate-950 p-2 sm:p-2.5 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-2"
          >
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2 w-full">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city, state, zip code, or address..."
                className="w-full text-sm sm:text-base bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3 rounded-xl sm:rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Search className="w-4 h-4" />
                <span>Search Homes</span>
              </button>
            </div>
          </form>

          {/* Popular Cities Quick Chips */}
          <div className="pt-2 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-medium mr-1">Popular:</span>
            {topCities.map((c) => (
              <button
                key={c.name}
                onClick={() => onNavigate('listings', c.query)}
                className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Transparency Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">100% Verified Photos</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Every unit is inspected with authentic, high-res photography.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Fixed $50 App Fee</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Transparent application fees with no hidden broker markups.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <PawPrint className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Pet-Friendly Policies</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Welcoming cats, dogs, and family companions nationwide.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">24-48h Approval</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rapid online verification and direct e-signature lease execution.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Fresh Nationwide Inventory</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              Featured Available Rentals
            </h2>
          </div>
          <button
            onClick={() => onNavigate('listings')}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span>View All {totalCount.toLocaleString()} Listings</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-80 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProperties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                onSelect={(id) => onSelectProperty(id)}
                onApply={(id) => onNavigate('apply', id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Interactive Application CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-md">
              Fast 6-Step Digital Application
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ready to secure your new rental?
            </h3>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              Complete your encrypted application online in minutes. Safe, paperless, and automatically routed to our property management team.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => onNavigate('apply')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm bg-white text-blue-700 hover:bg-blue-50 shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Start Application ($50)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('how-to-apply')}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-semibold text-sm bg-blue-800/60 hover:bg-blue-800 text-white border border-white/20 transition-colors"
            >
              How It Works
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
