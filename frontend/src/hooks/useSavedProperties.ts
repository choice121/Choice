import { useState, useEffect, useCallback } from 'react'
import { getSupabaseClient } from '../utils/supabase'
import { useAuth } from './useAuth'

export function useSavedProperties() {
  const { user } = useAuth()
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const fetchSaved = useCallback(async () => {
    if (!user) {
      const local = new Set<string>(JSON.parse(localStorage.getItem('cp_saved') || '[]'))
      setSavedIds(local)
      return
    }

    try {
      const client = getSupabaseClient()
      const { data, error } = await client
        .from('saved_properties')
        .select('property_id')
        .eq('user_id', user.id)

      if (error) {
        console.warn('Error fetching saved properties:', error)
        return
      }

      const ids = new Set<string>((data || []).map((r: any) => r.property_id))
      setSavedIds(ids)
    } catch (err) {
      console.warn('Failed to fetch saved properties', err)
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
      localStorage.setItem('cp_saved', JSON.stringify([...newSaved]))
      setSavedIds(newSaved)
      return { saved: isSaved }
    }

    const isCurrentlySaved = savedIds.has(propertyId)
    const newSaved = new Set(savedIds)
    if (isCurrentlySaved) newSaved.delete(propertyId)
    else newSaved.add(propertyId)
    setSavedIds(newSaved) // Optimistic update

    try {
      const client = getSupabaseClient()
      if (isCurrentlySaved) {
        await client.from('saved_properties').delete().eq('property_id', propertyId).eq('user_id', user.id)
      } else {
        await client.from('saved_properties').insert({ property_id: propertyId, user_id: user.id })
      }
      return { saved: !isCurrentlySaved }
    } catch (error) {
      // Revert optimistic update
      setSavedIds(savedIds)
      return { saved: isCurrentlySaved }
    }
  }

  return { savedIds, toggleSaved }
}
