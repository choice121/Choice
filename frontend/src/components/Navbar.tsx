import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  return (
    <header className={`cp-navbar sticky top-0 z-50 transition-all duration-200 ${scrolled ? 'shadow-sm' : 'border-b'}`}>
      <div className="cp-navbar-inner mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          to="/"
          className="cp-brand flex items-center gap-3 transition hover:opacity-90 focus:outline-none"
        >
          <div className="cp-brand-mark flex h-10 w-10 items-center justify-center rounded-xl bg-zillow-blue text-white shadow-sm">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <span className="cp-brand-name block text-lg font-bold tracking-tight text-slate-900">
              Choice Properties
            </span>
            <span className="cp-brand-tagline block text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
              Rental Marketplace
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav aria-label="Primary navigation" className="cp-nav-links hidden md:flex items-center gap-1 lg:gap-2">
          <Link
            to="/listings"
            aria-current={isActive('/listings') ? 'page' : undefined}
            className={`cp-nav-link rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive('/listings')
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            Browse Listings
          </Link>

          <Link
            to="/how-to-apply"
            aria-current={isActive('/how-to-apply') ? 'page' : undefined}
            className={`cp-nav-link rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive('/how-to-apply')
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            How to Apply
          </Link>

          <Link
            to="/faq"
            aria-current={isActive('/faq') ? 'page' : undefined}
            className={`cp-nav-link rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive('/faq')
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            FAQ
          </Link>

          <a
            href="/tenant/portal.html"
            target="_blank"
            rel="noopener noreferrer"
            className="cp-nav-link cp-nav-portal inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-zillow-green" />
            Track App
          </a>
          
          <div className="cp-nav-divider h-4 w-px bg-slate-200 mx-1"></div>

          <a
            href="/landlord/login.html"
            className="cp-nav-link cp-nav-portal rounded-lg px-3 py-2 text-sm font-medium transition text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            Landlords
          </a>
          <a
            href="/admin/login.html"
            className="cp-nav-link cp-nav-portal rounded-lg px-3 py-2 text-sm font-medium transition text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            Admin
          </a>
        </nav>

        {/* Right CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/apply"
            className="cp-nav-apply inline-flex items-center justify-center rounded-lg bg-zillow-blue px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zillow-blue-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            Apply Online
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/apply"
            className="cp-mobile-apply rounded-lg bg-zillow-blue px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
          >
            Apply
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="cp-mobile-toggle rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div id="mobile-navigation-menu" className="cp-mobile-menu md:hidden border-t border-slate-100 bg-white px-4 pt-2 pb-6 space-y-1 shadow-lg" aria-label="Mobile navigation">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Home
          </Link>
          <Link
            to="/listings"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Browse Listings
          </Link>
          <Link
            to="/how-to-apply"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            How to Apply
          </Link>
          <Link
            to="/faq"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            FAQ
          </Link>
          <a
            href="/tenant/portal.html"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Track Application
          </a>
          
          <div className="my-2 h-px bg-slate-100"></div>
          
          <a
            href="/landlord/login.html"
            className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Landlord Portal
          </a>
          <a
            href="/admin/login.html"
            className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Admin Portal
          </a>
          <Link
            to="/policies"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            Policies
          </Link>
          <div className="pt-4 pb-2">
            <Link
              to="/apply"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full rounded-lg bg-zillow-blue py-3 text-center font-semibold text-white shadow-sm hover:bg-zillow-blue-dark transition"
            >
              Start Rental Application
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

