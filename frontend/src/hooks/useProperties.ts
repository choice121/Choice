/**
 * React hook for fetching properties from Supabase.
 * Uses the getSupabaseClient and getProperties utilities to load live data.
 */

import { useEffect, useState, useCallback } from 'react'
import { getProperties } from '../utils/supabase'

export type PropertyData = {
  id: string
  title: string
  address: string
  city: string
  rent_monthly: number
  beds: number | null
  baths: number | null
  sqft: number | null
  status: string
}

export function useProperties(limit = 10) {
  const [properties, setProperties] = useState<PropertyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getProperties(limit)

      if (result.ok) {
        setProperties(result.data || [])
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
  }, [limit])

  useEffect(() => {
    refetch()
  }, [refetch])

  return {
    properties,
    loading,
    error,
    refetch,
  }
}
