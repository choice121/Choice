import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  Home, 
  Bed, 
  Bath, 
  Square, 
  Calendar, 
  DollarSign, 
  ExternalLink, 
  Filter, 
  Search, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Download, 
  RefreshCw, 
  ChevronRight, 
  X, 
  Tag, 
  MapPin, 
  Eye, 
  Sparkles, 
  ShieldCheck, 
  Database, 
  FileText, 
  Trash2,
  ChevronLeft,
  Info,
  Layers,
  ArrowUpDown,
  PlusCircle
} from 'lucide-react';
import { Property } from './types/property';
import { INITIAL_PIPELINE_PROPERTIES, MUSTANG_SEED_PROPERTIES } from './data/initialProperties';

const PIPELINE_STORAGE_KEY = 'mustang_pipeline_properties_v3';

export default function App() {
  // Start with empty pipeline since user requested "clear the pipeline"
  const [properties, setProperties] = useState<Property[]>(() => {
    try {
      const saved = localStorage.getItem(PIPELINE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return INITIAL_PIPELINE_PROPERTIES;
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(properties));
    } catch {
      // ignore
    }
  }, [properties]);

  const [activeStage, setActiveStage] = useState<'all' | 'in_pipeline' | 'under_review' | 'approved' | 'published'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'sqft_desc' | 'newest'>('price_asc');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState<number>(0);
  const [showIngestConsole, setShowIngestConsole] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Clear pipeline completely
  const handleClearPipeline = () => {
    setProperties([]);
    setSelectedProperty(null);
    try {
      localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify([]));
    } catch {
      // ignore
    }
    showToast('Pipeline completely cleared (0 properties)');
  };

  // Load 12 Mustang listings into pipeline
  const handleIngestMustangListings = () => {
    setProperties(MUSTANG_SEED_PROPERTIES);
    showToast('Ingested 12 Mustang 3-bedroom houses into pipeline (Unpublished)');
  };

  // When property selected, reset photo index and notes
  const handleSelectProperty = (prop: Property) => {
    setSelectedProperty(prop);
    setActivePhotoIdx(0);
    setEditingNotes(prop.notes || '');
  };

  // Pipeline metrics
  const metrics = useMemo(() => {
    const total = properties.length;
    const inPipelineCount = properties.filter(p => !p.published).length;
    const publishedCount = properties.filter(p => p.published).length;
    const underReviewCount = properties.filter(p => p.pipeline_stage === 'under_review').length;
    const draftCount = properties.filter(p => p.pipeline_stage === 'in_pipeline').length;
    const approvedCount = properties.filter(p => p.pipeline_stage === 'approved').length;

    const prices = properties.map(p => p.list_price).filter(p => p > 0);
    const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

    const sqfts = properties.map(p => p.sqft).filter((s): s is number => typeof s === 'number' && s > 0);
    const avgSqft = sqfts.length ? Math.round(sqfts.reduce((a, b) => a + b, 0) / sqfts.length) : 0;

    return {
      total,
      inPipelineCount,
      publishedCount,
      underReviewCount,
      draftCount,
      approvedCount,
      avgPrice,
      minPrice,
      maxPrice,
      avgSqft
    };
  }, [properties]);

  // Filtered & Sorted Properties
  const filteredProperties = useMemo(() => {
    return properties
      .filter(p => {
        if (activeStage === 'in_pipeline') return p.pipeline_stage === 'in_pipeline';
        if (activeStage === 'under_review') return p.pipeline_stage === 'under_review';
        if (activeStage === 'approved') return p.pipeline_stage === 'approved';
        if (activeStage === 'published') return p.published === true;
        return true;
      })
      .filter(p => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.formatted_address?.toLowerCase().includes(q) ||
          p.street?.toLowerCase().includes(q) ||
          p.zip_code?.includes(q) ||
          p.mls_id?.toLowerCase().includes(q) ||
          p.agent_name?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return (a.list_price || 0) - (b.list_price || 0);
        if (sortBy === 'price_desc') return (b.list_price || 0) - (a.list_price || 0);
        if (sortBy === 'sqft_desc') return (b.sqft || 0) - (a.sqft || 0);
        if (sortBy === 'newest') return (b.year_built || 0) - (a.year_built || 0);
        return 0;
      });
  }, [properties, activeStage, searchQuery, sortBy]);

  // Stage change handler
  const handleUpdateStage = (propId: string, newStage: Property['pipeline_stage']) => {
    const isNowPublished = newStage === 'published';
    setProperties(prev => prev.map(p => {
      if (p.id === propId) {
        return {
          ...p,
          pipeline_stage: newStage,
          published: isNowPublished,
          pipeline_status_label: isNowPublished ? 'Published Live' : (newStage === 'under_review' ? 'Under Due Diligence' : (newStage === 'approved' ? 'Approved (Ready)' : 'In Pipeline (Draft)'))
        };
      }
      return p;
    }));

    if (selectedProperty && selectedProperty.id === propId) {
      setSelectedProperty(prev => prev ? {
        ...prev,
        pipeline_stage: newStage,
        published: isNowPublished,
        pipeline_status_label: isNowPublished ? 'Published Live' : (newStage === 'under_review' ? 'Under Due Diligence' : (newStage === 'approved' ? 'Approved (Ready)' : 'In Pipeline (Draft)'))
      } : null);
    }

    showToast(`Listing moved to: ${newStage.replace('_', ' ').toUpperCase()}`);
  };

  // Save notes
  const handleSaveNotes = () => {
    if (!selectedProperty) return;
    setProperties(prev => prev.map(p => p.id === selectedProperty.id ? { ...p, notes: editingNotes } : p));
    setSelectedProperty(prev => prev ? { ...prev, notes: editingNotes } : null);
    showToast('Pipeline notes saved');
  };

  // Add tag
  const handleAddTag = () => {
    if (!selectedProperty || !newTagInput.trim()) return;
    const tag = newTagInput.trim();
    if (selectedProperty.tags?.includes(tag)) {
      setNewTagInput('');
      return;
    }
    const updatedTags = [...(selectedProperty.tags || []), tag];
    setProperties(prev => prev.map(p => p.id === selectedProperty.id ? { ...p, tags: updatedTags } : p));
    setSelectedProperty(prev => prev ? { ...prev, tags: updatedTags } : null);
    setNewTagInput('');
    showToast(`Added tag "${tag}"`);
  };

  // Download pipeline JSON
  const handleDownloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(properties, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `mustang_pipeline_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Exported pipeline JSON file');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-amber-500/50 shadow-2xl shadow-amber-500/10 px-5 py-3 rounded-xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-medium text-slate-100">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
              <Layers className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">Mustang Property Pipeline</h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 border ${
                  properties.length === 0 
                    ? 'bg-slate-800 text-slate-400 border-slate-700' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {properties.length === 0 ? 'Pipeline Cleared (Empty)' : `${properties.length} Staged • Unpublished`}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <span>Ingest Engine:</span>
                <span className="text-amber-300 font-mono">HomeHarvest API</span>
                <span>•</span>
                <span>Mustang, OK (3 Beds)</span>
                <span>•</span>
                <span className="text-slate-300 font-medium">Pipeline: {properties.length} properties</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {properties.length > 0 ? (
              <button
                onClick={handleClearPipeline}
                className="px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-lg flex items-center gap-1.5 transition"
                title="Empty and clear all listings from the pipeline"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Pipeline</span>
              </button>
            ) : (
              <button
                onClick={handleIngestMustangListings}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
                title="Load 12 3-bedroom Mustang properties into pipeline"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Ingest 12 Mustang Houses</span>
              </button>
            )}

            <button
              onClick={() => setShowIngestConsole(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg flex items-center gap-2 transition"
              title="View HomeHarvest scrape pipeline details & raw JSON"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Scrape Spec</span>
            </button>

            {properties.length > 0 && (
              <button
                onClick={handleDownloadJSON}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg flex items-center gap-2 transition"
                title="Download pipeline data as JSON"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export JSON</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col gap-6">
        
        {/* Pipeline Status Banner */}
        {properties.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center justify-center relative overflow-hidden">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
              <Layers className="w-7 h-7 stroke-[1.8]" />
            </div>
            <h2 className="text-xl font-bold text-white">Pipeline is Cleared</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-lg leading-relaxed">
              All properties have been cleared from the pipeline queue. The staging pipeline is currently empty (0 listings) and waiting for new data ingestion or batch processing.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleIngestMustangListings}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Ingest 12 Mustang Houses (3b)</span>
              </button>
              <button
                onClick={() => setShowIngestConsole(true)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition"
              >
                View HomeHarvest Spec
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold text-white">{properties.length} Houses In Pipeline</h2>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                      HomeHarvest Ingest Active
                    </span>
                    <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                      Status: Draft Only (Not Published)
                    </span>
                  </div>
                  <p className="text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    Active 3-bedroom single-family homes in <strong>Mustang, Oklahoma (73064)</strong> staged in the pipeline for evaluation, pricing audit, and review.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                <div className="text-right pr-3 border-r border-slate-700/80">
                  <div className="text-xs text-slate-400">Published Status</div>
                  <div className="text-sm font-bold text-slate-200">
                    {metrics.publishedCount} / {metrics.total} Published
                  </div>
                </div>
                <div className="text-right pl-2">
                  <div className="text-xs text-slate-400">Pipeline State</div>
                  <div className="text-sm font-bold text-amber-400">
                    {metrics.inPipelineCount} Drafts
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline Metrics KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
              <span>Total in Pipeline</span>
              <Building2 className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-white">{metrics.total}</div>
              <div className="text-xs text-slate-400">Properties Staged</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
              <span>Avg List Price</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-white">
                {metrics.avgPrice > 0 ? `$${metrics.avgPrice.toLocaleString()}` : '$0'}
              </div>
              <div className="text-xs text-slate-400">
                {metrics.minPrice > 0 ? `Range: $${metrics.minPrice.toLocaleString()} - $${metrics.maxPrice.toLocaleString()}` : 'No active listings'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
              <span>Bedrooms</span>
              <Bed className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-white">3 Beds</div>
              <div className="text-xs text-slate-400">Target Criteria</div>
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
              <span>Avg Living Area</span>
              <Square className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-white">
                {metrics.avgSqft > 0 ? `${metrics.avgSqft.toLocaleString()} sqft` : 'N/A'}
              </div>
              <div className="text-xs text-slate-400">Single Family Homes</div>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-1 bg-slate-900/90 border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
              <span>Publication Mode</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold text-amber-300">Unpublished</div>
              <div className="text-xs text-slate-400">0 Live Listings</div>
            </div>
          </div>
        </div>

        {/* Pipeline Controls & Filters */}
        {properties.length > 0 && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            
            {/* Stage Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setActiveStage('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeStage === 'all'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Staged ({metrics.total})
              </button>
              <button
                onClick={() => setActiveStage('in_pipeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeStage === 'in_pipeline'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Draft / Staged ({metrics.draftCount})
              </button>
              <button
                onClick={() => setActiveStage('under_review')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeStage === 'under_review'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Under Review ({metrics.underReviewCount})
              </button>
              <button
                onClick={() => setActiveStage('approved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeStage === 'approved'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Approved ({metrics.approvedCount})
              </button>
              <button
                onClick={() => setActiveStage('published')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                  activeStage === 'published'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Published ({metrics.publishedCount})
              </button>
            </div>

            {/* Search & Sort */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search address, street, MLS..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="price_asc" className="bg-slate-900">Price: Low to High</option>
                  <option value="price_desc" className="bg-slate-900">Price: High to Low</option>
                  <option value="sqft_desc" className="bg-slate-900">SqFt: High to Low</option>
                  <option value="newest" className="bg-slate-900">Newest Built</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Property Grid */}
        {properties.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProperties.map((property, index) => {
              const hasMultiplePhotos = property.photos && property.photos.length > 1;
              const photoUrl = property.primary_photo || property.photos[0] || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80';

              return (
                <div 
                  key={property.id}
                  className="bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/40 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col shadow-lg hover:shadow-2xl hover:shadow-amber-500/5 group"
                >
                  {/* Image Section */}
                  <div className="relative aspect-video bg-slate-950 overflow-hidden">
                    <img
                      src={photoUrl}
                      alt={property.formatted_address}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                      <span className="bg-amber-500/90 backdrop-blur-md text-slate-950 font-bold text-[11px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow">
                        <Clock className="w-3 h-3" />
                        In Pipeline
                      </span>
                      {!property.published && (
                        <span className="bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-200 text-[10px] font-medium px-2 py-0.5 rounded-full">
                          Draft
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-slate-200 text-xs px-2 py-0.5 rounded-md font-mono">
                      #{index + 1}
                    </div>

                    {/* Bottom Image Overlay: Price */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                      <div>
                        <div className="text-xl font-extrabold text-white tracking-tight drop-shadow-md">
                          ${property.list_price ? property.list_price.toLocaleString() : 'N/A'}
                        </div>
                        {property.price_per_sqft && (
                          <div className="text-[11px] text-slate-300 font-medium">
                            ${Math.round(property.price_per_sqft)} / sqft
                          </div>
                        )}
                      </div>

                      {hasMultiplePhotos && (
                        <span className="text-[10px] text-slate-300 bg-black/50 backdrop-blur-md px-2 py-0.5 rounded">
                          {property.photos.length} photos
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      {/* Address */}
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-semibold text-white group-hover:text-amber-300 transition line-clamp-1">
                            {property.street || property.formatted_address.split(',')[0]}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {property.city}, {property.state} {property.zip_code}
                          </p>
                        </div>
                      </div>

                      {/* Specs Row */}
                      <div className="grid grid-cols-3 gap-2 py-3 my-2 border-y border-slate-800/80 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Bed className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-semibold text-white">{property.beds}</span> Beds
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Bath className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-semibold text-white">{property.baths}</span> Baths
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Square className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-semibold text-white">{property.sqft?.toLocaleString() || 'N/A'}</span> sqft
                        </div>
                      </div>

                      {/* Additional Metadata */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Built: <strong className="text-slate-200">{property.year_built || 'N/A'}</strong></span>
                        <span>MLS ID: <strong className="text-slate-200 font-mono">{property.mls_id}</strong></span>
                        {property.days_on_mls !== null && property.days_on_mls !== undefined && (
                          <span>DOM: <strong className="text-slate-200">{property.days_on_mls}d</strong></span>
                        )}
                      </div>

                      {/* Tags */}
                      {property.tags && property.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-2.5">
                          {property.tags.slice(0, 3).map((tag, tIdx) => (
                            <span key={tIdx} className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions Row */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/60">
                      <button
                        onClick={() => handleSelectProperty(property)}
                        className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs rounded-lg flex items-center justify-center gap-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>Review Dossier</span>
                      </button>

                      <div className="relative group/menu">
                        <select
                          value={property.pipeline_stage}
                          onChange={(e) => handleUpdateStage(property.id, e.target.value as any)}
                          className="bg-slate-800 border border-slate-700 text-[11px] text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                          title="Update pipeline stage"
                        >
                          <option value="in_pipeline">Stage: Draft</option>
                          <option value="under_review">Stage: Review</option>
                          <option value="approved">Stage: Approved</option>
                          <option value="published">Stage: Publish</option>
                        </select>
                      </div>

                      {property.listing_url && (
                        <a
                          href={property.listing_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-slate-400 hover:text-amber-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition"
                          title="Open MLS listing on Realtor.com"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Property Detail Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md px-5 py-4 border-b border-slate-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-2.5">
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedProperty.pipeline_status_label}
                </span>
                <span className="text-xs text-slate-400 font-mono">MLS: {selectedProperty.mls_id}</span>
              </div>

              <div className="flex items-center gap-2">
                {selectedProperty.listing_url && (
                  <a
                    href={selectedProperty.listing_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
                  >
                    <span>View on Realtor.com</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 space-y-6">
              
              {/* Photo Gallery Carousel */}
              <div className="space-y-3">
                <div className="relative aspect-video sm:aspect-[21/9] bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <img
                    src={selectedProperty.photos[activePhotoIdx] || selectedProperty.primary_photo || ''}
                    alt={selectedProperty.formatted_address}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                  {selectedProperty.photos.length > 1 && (
                    <>
                      <button
                        onClick={() => setActivePhotoIdx(prev => (prev > 0 ? prev - 1 : selectedProperty.photos.length - 1))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition backdrop-blur-md"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setActivePhotoIdx(prev => (prev < selectedProperty.photos.length - 1 ? prev + 1 : 0))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition backdrop-blur-md"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="absolute bottom-3 right-3 text-xs bg-black/70 backdrop-blur-md text-white px-2.5 py-1 rounded-md font-mono">
                        Photo {activePhotoIdx + 1} of {selectedProperty.photos.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnails */}
                {selectedProperty.photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {selectedProperty.photos.map((photo, pIdx) => (
                      <button
                        key={pIdx}
                        onClick={() => setActivePhotoIdx(pIdx)}
                        className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition ${
                          activePhotoIdx === pIdx ? 'border-amber-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Price Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {selectedProperty.formatted_address}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span>{selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip_code} (Canadian County)</span>
                  </p>
                </div>

                <div className="sm:text-right">
                  <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
                    ${selectedProperty.list_price.toLocaleString()}
                  </div>
                  {selectedProperty.price_per_sqft && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      ${Math.round(selectedProperty.price_per_sqft)} / sq.ft.
                    </div>
                  )}
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Bed className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bedrooms</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">{selectedProperty.beds} Beds</div>
                </div>

                <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Bath className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bathrooms</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {selectedProperty.baths} Total ({selectedProperty.full_baths} full, {selectedProperty.half_baths} half)
                  </div>
                </div>

                <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Square className="w-3.5 h-3.5 text-amber-400" />
                    <span>Living Area</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {selectedProperty.sqft ? `${selectedProperty.sqft.toLocaleString()} sqft` : 'N/A'}
                  </div>
                </div>

                <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>Year Built</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {selectedProperty.year_built || 'N/A'}
                  </div>
                </div>
              </div>

              {/* MLS Details & Description */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="md:col-span-2 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>Property Description</span>
                    </h3>
                    <p className="text-xs leading-relaxed text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 whitespace-pre-line">
                      {selectedProperty.description || 'No description provided in MLS listing.'}
                    </p>
                  </div>

                  {/* Internal Pipeline Review Notes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <Tag className="w-4 h-4 text-amber-400" />
                        <span>Pipeline Notes & Due Diligence</span>
                      </h3>
                      <button
                        onClick={handleSaveNotes}
                        className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-2.5 py-1 rounded transition"
                      >
                        Save Notes
                      </button>
                    </div>
                    <textarea
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      rows={3}
                      placeholder="Add notes for this listing (e.g., rehab estimates, client match, comps)..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Pipeline Tags */}
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 mb-2">Tags</h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {selectedProperty.tags?.map((tag, tIdx) => (
                        <span key={tIdx} className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-md">
                          {tag}
                        </span>
                      ))}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                          placeholder="+ Add tag"
                          className="bg-slate-950 border border-slate-800 text-xs px-2.5 py-1 rounded-md text-slate-200 focus:outline-none focus:border-amber-500 w-24"
                        />
                        <button
                          onClick={handleAddTag}
                          className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar details */}
                <div className="space-y-4">
                  <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-3 text-xs">
                    <h4 className="font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>Listing & Agent Dossier</span>
                    </h4>

                    <div className="space-y-2">
                      <div>
                        <div className="text-slate-400">Agent:</div>
                        <div className="font-medium text-slate-200">{selectedProperty.agent_name || 'N/A'}</div>
                      </div>

                      <div>
                        <div className="text-slate-400">Brokerage:</div>
                        <div className="font-medium text-slate-200">{selectedProperty.broker_name || 'N/A'}</div>
                      </div>

                      {selectedProperty.lot_sqft && (
                        <div>
                          <div className="text-slate-400">Lot Size:</div>
                          <div className="font-medium text-slate-200">
                            {selectedProperty.lot_sqft.toLocaleString()} sqft ({(selectedProperty.lot_sqft / 43560).toFixed(2)} acres)
                          </div>
                        </div>
                      )}

                      {selectedProperty.garage_spaces && (
                        <div>
                          <div className="text-slate-400">Garage:</div>
                          <div className="font-medium text-slate-200">{selectedProperty.garage_spaces} Car</div>
                        </div>
                      )}

                      <div>
                        <div className="text-slate-400">HOA Fee:</div>
                        <div className="font-medium text-slate-200">
                          {selectedProperty.hoa_fee ? `$${selectedProperty.hoa_fee}/yr` : 'None reported'}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-400">Property Style:</div>
                        <div className="font-medium text-slate-200">{selectedProperty.property_style || 'Single Family'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Stage Transition Control */}
                  <div className="bg-amber-950/20 border border-amber-500/30 p-4 rounded-xl space-y-3">
                    <h4 className="font-semibold text-amber-300 text-xs flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Pipeline Stage Action</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 leading-normal">
                      Current: <strong>{selectedProperty.pipeline_status_label}</strong>
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        onClick={() => handleUpdateStage(selectedProperty.id, 'in_pipeline')}
                        className={`py-1.5 px-2 rounded font-medium transition ${
                          selectedProperty.pipeline_stage === 'in_pipeline'
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        Draft
                      </button>
                      <button
                        onClick={() => handleUpdateStage(selectedProperty.id, 'under_review')}
                        className={`py-1.5 px-2 rounded font-medium transition ${
                          selectedProperty.pipeline_stage === 'under_review'
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        Under Review
                      </button>
                      <button
                        onClick={() => handleUpdateStage(selectedProperty.id, 'approved')}
                        className={`py-1.5 px-2 rounded font-medium transition ${
                          selectedProperty.pipeline_stage === 'approved'
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const confirmPub = window.confirm("Publishing will mark this listing live. Proceed?");
                          if (confirmPub) {
                            handleUpdateStage(selectedProperty.id, 'published');
                          }
                        }}
                        className={`py-1.5 px-2 rounded font-medium transition ${
                          selectedProperty.pipeline_stage === 'published'
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        Publish Live
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-900 px-5 py-3.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                <span>Added to Pipeline: </span>
                <span className="text-slate-200 font-mono">
                  {new Date(selectedProperty.pipeline_added_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedProperty(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition font-medium"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrape / Ingest Console Modal */}
      {showIngestConsole && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">HomeHarvest Ingest Pipeline Specification</h3>
              </div>
              <button
                onClick={() => setShowIngestConsole(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono space-y-1.5 text-slate-300">
                <div className="text-amber-400 font-bold"># Python HomeHarvest API Execution</div>
                <div>from homeharvest import scrape_property</div>
                <div>&nbsp;</div>
                <div>properties = scrape_property(</div>
                <div className="pl-4 text-emerald-300">location="Mustang, OK",</div>
                <div className="pl-4 text-emerald-300">listing_type="for_sale",</div>
                <div className="pl-4 text-emerald-300">beds_min=3,</div>
                <div className="pl-4 text-emerald-300">beds_max=3,</div>
                <div className="pl-4 text-emerald-300">property_type=["single_family"],</div>
                <div className="pl-4 text-emerald-300">limit=12</div>
                <div>)</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-slate-400 font-medium">Target Location:</div>
                  <div className="text-base font-bold text-white">Mustang, OK 73064</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-slate-400 font-medium">Bedrooms Criterion:</div>
                  <div className="text-base font-bold text-white">Exactly 3 Beds (3b)</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-slate-400 font-medium">Current Pipeline Items:</div>
                  <div className="text-base font-bold text-amber-400">{properties.length} listings</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="text-slate-400 font-medium">Published Flag:</div>
                  <div className="text-base font-bold text-amber-400">false (Draft Only)</div>
                </div>
              </div>

              <div>
                <div className="text-slate-400 mb-1.5 font-medium">Data Pipeline Destination:</div>
                <div className="p-2 bg-slate-950 rounded border border-slate-800 font-mono text-slate-300 text-[11px]">
                  src/data/pipeline_properties.json
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  onClick={handleIngestMustangListings}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Load 12 Scraped Mustang Listings
                </button>

                <div className="flex items-center gap-2">
                  {properties.length > 0 && (
                    <button
                      onClick={handleDownloadJSON}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download JSON
                    </button>
                  )}
                  <button
                    onClick={() => setShowIngestConsole(false)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg text-xs transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${properties.length === 0 ? 'bg-slate-500' : 'bg-emerald-400 animate-pulse'}`} />
            <span>Mustang Property Ingest Pipeline • HomeHarvest Connector</span>
          </div>
          <div>
            {properties.length === 0 ? 'Pipeline is Empty' : `${properties.length} Properties In Pipeline • Unpublished`}
          </div>
        </div>
      </footer>
    </div>
  );
}
