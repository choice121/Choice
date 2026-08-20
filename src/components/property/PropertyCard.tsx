import React, { useState } from 'react';
import { 
  Bed, 
  Bath, 
  Square, 
  MapPin, 
  CheckCircle, 
  Heart, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight,
  ShieldCheck,
  PawPrint
} from 'lucide-react';
import type { Property, PropertyPhoto } from '../../types';
import { formatImageUrl } from '../../lib/supabase';

interface PropertyCardProps {
  property: Property;
  onSelect: (propertyId: string) => void;
  onApply: (propertyId: string) => void;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, onSelect, onApply }) => {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);

  // Extract photos list safely
  const photosList: string[] = Array.isArray(property.photos)
    ? property.photos.map((p) => (typeof p === 'string' ? p : (p as PropertyPhoto).url))
    : property.hero_photo_url
    ? [property.hero_photo_url]
    : ['/assets/placeholder-property.jpg'];

  const displayPhotos = photosList.length > 0 ? photosList : ['/assets/placeholder-property.jpg'];
  const currentPhoto = displayPhotos[photoIndex] || displayPhotos[0];

  const handlePrevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev === 0 ? displayPhotos.length - 1 : prev - 1));
  };

  const handleNextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev === displayPhotos.length - 1 ? 0 : prev + 1));
  };

  const toggleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
  };

  return (
    <div
      onClick={() => onSelect(property.id)}
      className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 overflow-hidden shadow-xs hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 flex flex-col cursor-pointer"
    >
      {/* Image Carousel / Hero */}
      <div className="relative aspect-4/3 sm:aspect-16/10 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={formatImageUrl(currentPhoto, 600, 75)}
          alt={property.title || property.address}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/assets/placeholder-property.jpg';
          }}
        />

        {/* Gradient Overlay for badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600/90 text-white backdrop-blur-md shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
            {property.pets_allowed !== false && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-600/90 text-white backdrop-blur-md shadow-sm">
                <PawPrint className="w-3 h-3" />
                <span>Pet Friendly</span>
              </span>
            )}
          </div>

          <button
            onClick={toggleSave}
            className={`p-2 rounded-full backdrop-blur-md transition-colors ${
              isSaved
                ? 'bg-rose-500 text-white'
                : 'bg-black/40 text-white hover:bg-black/60'
            }`}
            aria-label="Save listing"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Carousel Navigation Arrows */}
        {displayPhotos.length > 1 && (
          <>
            <button
              onClick={handlePrevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next photo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Photo Counter */}
            <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-black/60 text-white text-[11px] font-medium backdrop-blur-xs">
              {photoIndex + 1}/{displayPhotos.length}
            </div>
          </>
        )}

        {/* Bottom Left Price Pill */}
        <div className="absolute bottom-3 left-3 text-white">
          <div className="text-xl sm:text-2xl font-extrabold tracking-tight drop-shadow-md">
            ${property.rent?.toLocaleString() || '—'}
            <span className="text-xs sm:text-sm font-normal opacity-90">/mo</span>
          </div>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* Key Specs Row */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <Bed className="w-4 h-4 text-blue-500" />
              <span>{property.beds} {property.beds === 1 ? 'Bed' : 'Beds'}</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <div className="flex items-center gap-1.5">
              <Bath className="w-4 h-4 text-blue-500" />
              <span>{property.baths} {property.baths === 1 ? 'Bath' : 'Baths'}</span>
            </div>
            {property.sqft && (
              <>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <div className="flex items-center gap-1.5">
                  <Square className="w-4 h-4 text-blue-500" />
                  <span>{property.sqft?.toLocaleString()} sqft</span>
                </div>
              </>
            )}
          </div>

          {/* Address & Title */}
          <div className="mt-3 space-y-1">
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {property.address}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              <span className="truncate">{property.city}, {property.state} {property.zip}</span>
            </div>
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="pt-2 flex items-center justify-between gap-2">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">$50 App Fee</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onApply(property.id);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs hover:shadow-md transition-all active:scale-95"
            >
              Apply Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
