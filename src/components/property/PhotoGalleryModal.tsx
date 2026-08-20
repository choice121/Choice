import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, ShieldCheck } from 'lucide-react';
import { formatImageUrl } from '../../lib/supabase';

interface PhotoGalleryModalProps {
  photos: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

export const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  photos,
  initialIndex = 0,
  isOpen,
  onClose,
  title,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, photos.length]);

  if (!isOpen || photos.length === 0) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between backdrop-blur-md">
      {/* Top Bar */}
      <div className="px-4 py-3 flex items-center justify-between text-white border-b border-white/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold truncate max-w-[60vw]">{title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-white/70">
            {currentIndex + 1} / {photos.length}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            aria-label="Close photo gallery"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative flex-1 flex items-center justify-center p-4">
        <button
          onClick={handlePrev}
          className="absolute left-4 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 z-10 transition-all active:scale-95"
          aria-label="Previous photo"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <img
          src={formatImageUrl(photos[currentIndex], 1600, 85)}
          alt={`${title} - Photo ${currentIndex + 1}`}
          className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl transition-opacity duration-200"
        />

        <button
          onClick={handleNext}
          className="absolute right-4 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white border border-white/20 z-10 transition-all active:scale-95"
          aria-label="Next photo"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom Thumbnail Strip */}
      <div className="px-4 py-3 border-t border-white/10 overflow-x-auto flex items-center gap-2 justify-start sm:justify-center">
        {photos.map((url, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={`relative flex-shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-all ${
              currentIndex === idx
                ? 'border-blue-500 scale-105 opacity-100 shadow-md'
                : 'border-transparent opacity-50 hover:opacity-80'
            }`}
          >
            <img
              src={formatImageUrl(url, 150, 60)}
              alt="Thumbnail"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
};
