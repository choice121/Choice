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
  state?: string
  zip?: string
  rent_monthly: number
  beds: number | null
  baths: number | null
  sqft: number | null
  status: string
  pet_friendly?: boolean
  application_fee?: number
  security_deposit?: number
  photo_url: string | null
}

export function useProperties(limit = 10) {
  const [properties, setProperties] = useState<PropertyData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchListings = useCallback(async () => {
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
    let isMounted = true
    getProperties(limit).then((result) => {
      if (!isMounted) return
      if (result.ok) {
        setProperties(result.data || [])
      } else {
        setError(result.error || 'Failed to fetch properties')
      }
      setLoading(false)
    }).catch((e) => {
      if (!isMounted) return
      setError(String(e))
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [limit])

  return {
    properties,
    loading,
    error,
    refetch: fetchListings,
  }
}
