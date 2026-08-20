import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  MapPin, 
  Bed, 
  Bath, 
  Square, 
  ShieldCheck, 
  PawPrint, 
  DollarSign, 
  Calendar, 
  Share2, 
  Heart, 
  Sparkles, 
  CheckCircle2, 
  Maximize2, 
  MessageSquare, 
  ChevronRight,
  Home,
  Check,
  Clock,
  Layers
} from 'lucide-react';
import type { Property, PropertyPhoto } from '../types';
import { getPropertyById, formatImageUrl } from '../lib/supabase';
import { PhotoGalleryModal } from '../components/property/PhotoGalleryModal';
import { InquiryModal } from '../components/property/InquiryModal';

interface PropertyDetailViewProps {
  propertyId: string;
  onBack: () => void;
  onApply: (propertyId: string) => void;
}

export const PropertyDetailView: React.FC<PropertyDetailViewProps> = ({
  propertyId,
  onBack,
  onApply,
}) => {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await getPropertyById(propertyId);
      if (res.data) {
        setProperty(res.data);
      }
      setLoading(false);
    }
    load();
  }, [propertyId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse" />
        <div className="h-96 w-full bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Property Not Found</h2>
        <p className="text-xs text-slate-500">The listing you requested may have been leased or moved.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white"
        >
          Return to Listings
        </button>
      </div>
    );
  }

  const photosList: string[] = Array.isArray(property.photos)
    ? property.photos.map((p) => (typeof p === 'string' ? p : (p as PropertyPhoto).url))
    : property.hero_photo_url
    ? [property.hero_photo_url]
    : ['/assets/placeholder-property.jpg'];

  const displayPhotos = photosList.length > 0 ? photosList : ['/assets/placeholder-property.jpg'];

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Amenities parsing
  const amenitiesList: string[] = Array.isArray(property.amenities)
    ? property.amenities
    : typeof property.amenities === 'string'
    ? property.amenities.split(',').map((s) => s.trim())
    : [
        'Central Air Conditioning',
        'Dishwasher Included',
        'In-Unit Washer & Dryer Hookups',
        'Hardwood & Tile Flooring',
        'Pet Friendly Living',
        'Spacious Yard / Balcony',
        'Dedicated Parking / Garage',
        'High-Speed Internet Ready',
      ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      {/* Navigation Breadcrumb & Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Listings</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors relative"
            title="Copy Share Link"
            aria-label="Share property"
          >
            <Share2 className="w-4 h-4" />
            {copied && (
              <span className="absolute -bottom-7 right-0 text-[10px] font-bold px-2 py-0.5 rounded-md bg-black text-white whitespace-nowrap">
                Link Copied!
              </span>
            )}
          </button>
          <button
            onClick={() => setIsSaved(!isSaved)}
            className={`p-2 rounded-xl transition-colors ${
              isSaved ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
            title="Save Property"
            aria-label="Save property"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Modern Full-Bleed Photo Gallery Mosaic */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-3xl overflow-hidden shadow-xl border border-slate-200/80 dark:border-slate-800 bg-slate-900">
          {/* Main Hero Photo (Left 2.5 cols) */}
          <div
            onClick={() => {
              setActivePhotoIndex(0);
              setGalleryOpen(true);
            }}
            className="md:col-span-3 relative aspect-4/3 sm:aspect-16/10 overflow-hidden cursor-pointer group"
          >
            <img
              src={formatImageUrl(displayPhotos[0], 1200, 85)}
              alt={property.title}
              className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

            {/* Badges Overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-md backdrop-blur-md">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Listing</span>
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-md backdrop-blur-md">
                <PawPrint className="w-3.5 h-3.5" />
                <span>Pet Friendly</span>
              </span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setGalleryOpen(true);
              }}
              className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-black/70 hover:bg-black text-white backdrop-blur-md transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>View All {displayPhotos.length} Photos</span>
            </button>
          </div>

          {/* Right Column Photos (2 Stacked) */}
          <div className="hidden md:grid grid-rows-2 gap-3">
            {displayPhotos.slice(1, 3).map((url, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setActivePhotoIndex(idx + 1);
                  setGalleryOpen(true);
                }}
                className="relative h-full overflow-hidden cursor-pointer group"
              >
                <img
                  src={formatImageUrl(url, 600, 80)}
                  alt="Property detail"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Horizontal Thumbnail Slider */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:hidden">
          {displayPhotos.map((url, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActivePhotoIndex(idx);
                setGalleryOpen(true);
              }}
              className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-800"
            >
              <img src={formatImageUrl(url, 200, 65)} alt="Thumbnail" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      {/* Main Content & Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Details & Overview */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header Card */}
          <div className="space-y-3 pb-6 border-b border-slate-200 dark:border-slate-800">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {property.address}
            </h1>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span>{property.city}, {property.state} {property.zip}</span>
            </div>

            {/* Quick Spec Pills */}
            <div className="pt-3 flex items-center gap-3 sm:gap-4 flex-wrap">
              <div className="px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-sm">
                <Bed className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{property.beds} {property.beds === 1 ? 'Bedroom' : 'Bedrooms'}</span>
              </div>
              <div className="px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-sm">
                <Bath className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>{property.baths} {property.baths === 1 ? 'Bathroom' : 'Bathrooms'}</span>
              </div>
              {property.sqft && (
                <div className="px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold text-sm">
                  <Square className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>{property.sqft.toLocaleString()} Sq Ft</span>
                </div>
              )}
            </div>
          </div>

          {/* Description Section */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">About This Rental</h2>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2 whitespace-pre-line">
              {property.description ||
                `Welcome to ${property.address} located in prime ${property.city}, ${property.state}. This charming home features ${property.beds} bedrooms and ${property.baths} bathrooms with comfortable living spaces, modern appliances, and convenient access to local shopping, dining, and transit.`}
            </div>
          </div>

          {/* Standard Policies & Highlights (No smoking tab per rules) */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Lease Policies & Terms</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <PawPrint className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">Pet-Friendly Living</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">All pets welcome. Standard pet deposit and registration required.</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">Standard Security Deposit</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">1x monthly rent ($${property.deposit?.toLocaleString() || property.rent?.toLocaleString()}) due at lease signing.</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <Calendar className="w-5 h-5 text-purple-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">Standard 12-Month Lease</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Flexible renewable 12-month standard residential lease.</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold text-sm text-slate-900 dark:text-white block">$50 Application Fee</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Covers comprehensive background and employment screening.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Features & Amenities */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Features & Amenities</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {amenitiesList.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Sticky Pricing & Apply Card */}
        <div className="space-y-6">
          <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-6">
            {/* Rent Header */}
            <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Rent</span>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                ${property.rent?.toLocaleString()}
                <span className="text-sm font-normal text-slate-500"> / month</span>
              </div>
            </div>

            {/* Financial Transparency Table */}
            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span>Application Fee:</span>
                <span className="font-bold text-slate-900 dark:text-white">$50 / applicant</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Security Deposit:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ${property.deposit?.toLocaleString() || property.rent?.toLocaleString()} (1x Rent)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pet Policy:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Allowed / Pet Friendly</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Availability:</span>
                <span className="font-bold text-slate-900 dark:text-white">Immediate Move-In Ready</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => onApply(property.id)}
                className="w-full py-3.5 rounded-2xl font-extrabold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-98"
              >
                <span>Apply for this Property ($50)</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setInquiryOpen(true)}
                className="w-full py-3 rounded-2xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span>Schedule a Tour / Inquire</span>
              </button>
            </div>

            <div className="text-[11px] text-center text-slate-400 leading-relaxed">
              Applications are reviewed in the order received. Fast 24-48 hour approval turnaround.
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox & Inquiry Modals */}
      <PhotoGalleryModal
        photos={displayPhotos}
        initialIndex={activePhotoIndex}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title={property.address}
      />

      <InquiryModal
        propertyId={property.id}
        propertyAddress={property.address}
        isOpen={inquiryOpen}
        onClose={() => setInquiryOpen(false)}
      />
    </div>
  );
};
