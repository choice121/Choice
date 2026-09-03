import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    L: any
  }
}

interface PropertyMapProps {
  lat: number | string | null | undefined
  lng: number | string | null | undefined
  address: string
  title?: string
  monthly_rent?: number
}

export function PropertyMap({ lat, lng, address, title, monthly_rent }: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!lat || !lng || !mapRef.current) return

    const latNum = parseFloat(String(lat))
    const lngNum = parseFloat(String(lng))

    if (isNaN(latNum) || isNaN(lngNum)) {
      setError(true)
      return
    }

    const loadLeaflet = async () => {
      // Load CSS
      if (!document.querySelector(`link[href*="leaflet.min.css"]`)) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
      }

      // Load JS
      if (!window.L) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'
          script.crossOrigin = 'anonymous'
          script.onload = () => resolve()
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      if (!mapRef.current) return

      // Clear any existing map instances if re-rendering
      const container = mapRef.current
      container.innerHTML = '<div id="propertyMiniMap" style="width:100%;height:100%;border-radius:0.75rem;"></div>'
      
      const map = window.L.map('propertyMiniMap', { 
        zoomControl: true, 
        scrollWheelZoom: false, 
        touchZoom: true 
      }).setView([latNum, lngNum], 15)

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19
      }).addTo(map)

      const iconHtml = `<div style="background:#0e0e0f;color: white;padding:6px 12px;border-radius:20px;font-weight:700;font-size:12px;font-family:'Plus Jakarta Sans',sans-serif;white-space:nowrap;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">${monthly_rent != null ? '$' + Number(monthly_rent).toLocaleString() + '/mo' : 'Rent TBD'}</div>`

      const icon = window.L.divIcon({
        className: '',
        html: iconHtml,
        iconAnchor: [45, 16], 
        iconSize: [90, 32]
      })

      window.L.marker([latNum, lngNum], { icon })
        .addTo(map)
        .bindPopup(`<b>${title || address}</b><br>${address}`)
    }

    // Set up observer for lazy loading
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect()
        loadLeaflet().catch(() => setError(true))
      }
    })

    observer.observe(mapRef.current)

    return () => observer.disconnect()
  }, [lat, lng, address, title, monthly_rent])

  if (error || !lat || !lng) {
    return null
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 shadow-xl space-y-4">
      <h2 className="text-xl font-bold text-white">Neighborhood</h2>
      <div 
        ref={mapRef} 
        className="aspect-[16/9] sm:aspect-[21/9] w-full rounded-xl bg-slate-950 relative z-0"
      />
    </div>
  )
}
