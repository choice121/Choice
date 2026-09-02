import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

interface PageMetaDefinition {
  title: string
  description: string
  type?: 'website' | 'article'
}

const DEFAULT_META: PageMetaDefinition = {
  title: 'Choice Properties — Find Your Next Home Nationwide',
  description: 'Browse verified rental listings across the United States. Apartments, houses, and condos — apply online in minutes.',
}

const PAGE_META: Array<{ matches: (pathname: string) => boolean; meta: PageMetaDefinition }> = [
  {
    matches: (pathname) => pathname === '/' || pathname === '/index.html' || pathname.startsWith('/listings'),
    meta: {
      title: 'Browse Rental Listings Nationwide | Choice Properties',
      description: 'Browse verified apartments, houses, and condos for rent across the United States with transparent pricing and online applications.',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/property'),
    meta: {
      title: 'Rental Property Details | Choice Properties',
      description: 'Review verified rental home details, pricing, photos, pets policy, and application information from Choice Properties.',
      type: 'article',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/apply'),
    meta: {
      title: 'Rental Application | Choice Properties',
      description: 'Complete the Choice Properties rental application securely. The standard application screening fee is $50.',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/faq'),
    meta: {
      title: 'Rental FAQ | Choice Properties',
      description: 'Find answers about Choice Properties listings, applications, screening, deposits, pets, and renter support.',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/how-to-apply'),
    meta: {
      title: 'How to Apply for a Rental | Choice Properties',
      description: 'Learn how the Choice Properties rental application works, what documents you need, and what happens after you apply.',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/how-it-works'),
    meta: {
      title: 'How Choice Properties Works | Choice Properties',
      description: 'See how Choice Properties helps renters find verified homes and helps landlords manage the rental process.',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/fair-housing'),
    meta: {
      title: 'Fair Housing Commitment | Choice Properties',
      description: 'Read the Choice Properties fair housing commitment and equal housing opportunity policy.',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/policies') || pathname.startsWith('/rental-application-policy') || pathname.startsWith('/holding-deposit-policy'),
    meta: {
      title: 'Rental Policies | Choice Properties',
      description: 'Review Choice Properties rental application, holding deposit, screening, and platform policies.',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/privacy'),
    meta: {
      title: 'Privacy Policy | Choice Properties',
      description: 'Read how Choice Properties collects, uses, and protects information on the rental marketplace.',
    },
  },
  {
    matches: (pathname) => pathname.startsWith('/terms'),
    meta: {
      title: 'Terms of Service | Choice Properties',
      description: 'Review the Choice Properties terms governing use of the rental marketplace and application services.',
    },
  },
]

function upsertMeta(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, name)
    document.head.appendChild(element)
  }
  element.content = content
}

export function PageMeta() {
  const location = useLocation()

  useEffect(() => {
    const definition = PAGE_META.find((entry) => entry.matches(location.pathname))?.meta || DEFAULT_META
    const canonicalPath = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/'
    const canonicalUrl = new URL(canonicalPath, window.location.origin).toString()
    const socialImageUrl = new URL('/assets/og-cover.jpg', window.location.origin).toString()

    document.title = definition.title
    upsertMeta('description', definition.description)
    upsertMeta('og:title', definition.title, 'property')
    upsertMeta('og:description', definition.description, 'property')
    upsertMeta('og:type', definition.type || 'website', 'property')
    upsertMeta('og:url', canonicalUrl, 'property')
    upsertMeta('og:image', socialImageUrl, 'property')
    upsertMeta('og:site_name', 'Choice Properties', 'property')
    upsertMeta('twitter:card', 'summary_large_image')
    upsertMeta('twitter:title', definition.title)
    upsertMeta('twitter:description', definition.description)
    upsertMeta('twitter:image', socialImageUrl)

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl
  }, [location.pathname])

  return null
}