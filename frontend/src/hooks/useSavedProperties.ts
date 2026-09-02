import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '../utils/supabase'
import { useAuth } from './useAuth'

function readLocalSaved() {
  try {
    const value = JSON.parse(localStorage.getItem('cp_saved') || '[]')
    return new Set<string>(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    localStorage.removeItem('cp_saved')
    return new Set<string>()
  }
}

function persistLocalSaved(ids: Set<string>) {
  localStorage.setItem('cp_saved', JSON.stringify([...ids]))
}

export function useSavedProperties() {
  const { user } = useAuth()
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const fetchSaved = useCallback(async () => {
    const localIds = readLocalSaved()
    if (!user) {
      setSavedIds(localIds)
      setError(null)
      return
    }

    try {
      const client = getSupabaseClient()
      const { data, error } = await client
        .from('saved_properties')
        .select('property_id')
        .eq('user_id', user.id)

      if (error) {
        setSavedIds(localIds)
        setError(error.message)
        return
      }

      const remoteIds = new Set<string>((data || []).map((r: any) => r.property_id).filter(Boolean))
      const ids = new Set([...remoteIds, ...localIds])

      // Preserve anonymous saves when a visitor signs in. Inserts are
      // idempotent at the database boundary; a duplicate is harmless.
      for (const propertyId of localIds) {
        if (remoteIds.has(propertyId)) continue
        const result = await client.from('saved_properties').insert({ property_id: propertyId, user_id: user.id })
        if (result.error && !String(result.error.message || '').toLowerCase().includes('duplicate')) {
          throw new Error(result.error.message)
        }
      }

      setSavedIds(ids)
      persistLocalSaved(ids)
      setError(null)
    } catch (err) {
      setSavedIds(localIds)
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [user])

  useEffect(() => {
    fetchSaved()
  }, [fetchSaved])

  const toggleSaved = async (propertyId: string) => {
    if (!user) {
      const newSaved = new Set(savedIds)
      const isSaved = !newSaved.has(propertyId)
      if (isSaved) newSaved.add(propertyId)
      else newSaved.delete(propertyId)
      persistLocalSaved(newSaved)
      setSavedIds(newSaved)
      setError(null)
      return { saved: isSaved }
    }

    const isCurrentlySaved = savedIds.has(propertyId)

    try {
      const client = getSupabaseClient()
      if (isCurrentlySaved) {
        const result = await client.from('saved_properties').delete().eq('property_id', propertyId).eq('user_id', user.id)
        if (result.error) throw new Error(result.error.message)
      } else {
        const result = await client.from('saved_properties').insert({ property_id: propertyId, user_id: user.id })
        if (result.error && !String(result.error.message || '').toLowerCase().includes('duplicate')) {
          throw new Error(result.error.message)
        }
      }
      const newSaved = new Set(savedIds)
      if (isCurrentlySaved) newSaved.delete(propertyId)
      else newSaved.add(propertyId)
      persistLocalSaved(newSaved)
      setSavedIds(newSaved)
      setError(null)
      return { saved: !isCurrentlySaved }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return { saved: isCurrentlySaved }
    }
  }

  return { savedIds, toggleSaved, error, refetch: fetchSaved }
}
