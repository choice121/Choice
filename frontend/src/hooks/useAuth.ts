/**
 * React hook for accessing the shared Supabase auth state from window.cp-api.js.
 * This bridges the legacy cp-api.js Auth helpers into React components.
 * The hook does NOT initialize auth—it reuses the existing session from cp-api.js.
 */

import { useEffect, useState, useCallback } from 'react'

export type AuthUser = {
  id: string
  email?: string
  user_metadata?: Record<string, any>
}

export type AuthSession = {
  access_token: string
  refresh_token?: string
  expires_at?: number
  user?: AuthUser
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Access the global Auth object exposed by cp-api.js
  const getAuth = useCallback(() => {
    if (typeof window === 'undefined') return null
    // The Auth namespace is exported from cp-api.js and available globally
    return (window as any).Auth ?? (window as any).CP?.Auth
  }, [])

  useEffect(() => {
    let mounted = true
    let unsubscribe: (() => void) | undefined

    async function checkAuth() {
      try {
        setLoading(true)
        const Auth = getAuth()

        if (!Auth) {
          setError('Auth API not loaded')
          setUser(null)
          setSession(null)
          return
        }

        // Read the cached session first so React observes the same session
        // source as the legacy client without an unnecessary user round-trip.
        const currentSession = await Auth.getSession()
        const currentUser = currentSession?.user ?? (currentSession ? await Auth.getUser() : null)
        if (mounted) {
          setUser(currentUser)
          setError(null)
        }

        if (mounted) {
          setSession(currentSession)
        }

        const client = (window as any).CP?.sb?.()
        const authSubscription = client?.auth?.onAuthStateChange?.((_event: string, nextSession: AuthSession | null) => {
          if (!mounted) return
          setSession(nextSession)
          setUser(nextSession?.user ?? null)
          setError(null)
        })
        unsubscribe = authSubscription?.data?.subscription?.unsubscribe
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : String(e))
          setUser(null)
          setSession(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkAuth()

    return () => {
      mounted = false
      unsubscribe?.()
    }
  }, [getAuth])

  return {
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user,
  }
}

/**
 * Declare Auth as globally accessible from cp-api.js.
 */
declare global {
  interface Window {
    Auth: {
      getUser(): Promise<AuthUser | null>
      getSession(): Promise<AuthSession | null>
      getAccessToken(): Promise<string | null>
      signOut(): Promise<void>
      isAdmin(): Promise<boolean>
      requireLandlord(redirectTo?: string): Promise<any>
      requireAdmin(redirectTo?: string): Promise<any>
    }
  }
}
