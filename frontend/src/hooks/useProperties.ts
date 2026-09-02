/**
 * React hook for fetching properties from Supabase.
 * Uses the getSupabaseClient and getProperties utilities to load live data.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { getProperties, type PropertyData, type PropertyFilters } from '../utils/supabase'

export type { PropertyData } from '../utils/supabase'

export function useProperties(options: PropertyFilters | number = {}) {
  const optionsKey = typeof options === 'number'
    ? JSON.stringify({ per_page: options })
    : JSON.stringify(options)
  const [properties, setProperties] = useState<PropertyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState({ total: 0, page: 1, per_page: 24, total_pages: 0 })
  const requestRef = useRef(0)

  const fetchListings = useCallback(async () => {
    const requestId = ++requestRef.current
    try {
      setLoading(true)
      setError(null)
      const filters = JSON.parse(optionsKey) as PropertyFilters
      const result = await getProperties(filters)
      if (requestId !== requestRef.current) return

      if (result.ok) {
        setProperties(result.data?.rows || [])
        setMeta({
          total: result.data?.total || 0,
          page: result.data?.page || 1,
          per_page: result.data?.per_page || 24,
          total_pages: result.data?.total_pages || 0,
        })
      } else {
        setError(result.error || 'Failed to fetch properties')
        setProperties([])
      }
    } catch (e) {
      setError(String(e))
      setProperties([])
    } finally {
      setLoading(false)
    }
  }, [optionsKey])

  useEffect(() => {
    void fetchListings()
  }, [fetchListings])

  return {
    properties,
    loading,
    error,
    refetch: fetchListings,
    ...meta,
  }
}
