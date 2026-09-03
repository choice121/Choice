import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Photo {
  url: string
}

interface LightboxProps {
  photos: Photo[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onNavigate: (index: number) => void
}

export function Lightbox({ photos, currentIndex, isOpen, onClose, onNavigate }: LightboxProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowRight') onNavigate((currentIndex + 1) % photos.length)
    if (e.key === 'ArrowLeft') onNavigate((currentIndex - 1 + photos.length) % photos.length)
  }, [isOpen, currentIndex, photos.length, onClose, onNavigate])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Property photo gallery"
    >
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 z-10">
        <div className="rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white shadow-sm border border-white/10">
          {currentIndex + 1} / {photos.length}
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
          aria-label="Close gallery"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center p-4 min-h-0">
        <button
          onClick={() => onNavigate((currentIndex - 1 + photos.length) % photos.length)}
          className="absolute left-2 sm:left-4 z-10 rounded-full p-2 sm:p-3 bg-black/50 text-white hover:bg-black/80 border border-white/10 transition"
          aria-label="Previous photo"
        >
          <svg className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <img
          src={window.CONFIG?.img ? window.CONFIG.img(photos[currentIndex]?.url, 'gallery') : photos[currentIndex]?.url}
          alt={`Property photo ${currentIndex + 1}`}
          className="max-h-full max-w-full object-contain pointer-events-none select-none"
        />

        <button
          onClick={() => onNavigate((currentIndex + 1) % photos.length)}
          className="absolute right-2 sm:right-4 z-10 rounded-full p-2 sm:p-3 bg-black/50 text-white hover:bg-black/80 border border-white/10 transition"
          aria-label="Next photo"
        >
          <svg className="h-6 w-6 sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {photos.length > 1 && (
        <div className="flex h-24 items-center justify-center gap-2 overflow-x-auto px-4 pb-4">
          {photos.map((photo, index) => (
            <button
              key={`${photo.url}-${index}`}
              onClick={() => onNavigate(index)}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                currentIndex === index ? 'border-white opacity-100 ring-2 ring-white/20' : 'border-white/10 opacity-40 hover:opacity-100'
              }`}
            >
              <img
                src={window.CONFIG?.img ? window.CONFIG.img(photo.url, 'thumb') : photo.url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
