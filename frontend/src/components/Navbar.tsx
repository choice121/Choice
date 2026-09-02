import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 transition hover:opacity-90 focus:outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-950/50">
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
            <span className="block text-lg font-bold tracking-tight text-white">
              Choice Properties
            </span>
            <span className="block text-[11px] font-medium tracking-wider text-cyan-300 uppercase">
              Rental Marketplace
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1 lg:gap-2">
          <Link
            to="/listings"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive('/listings')
                ? 'bg-slate-800 text-cyan-300'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            Browse Listings
          </Link>

          <Link
            to="/how-to-apply"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive('/how-to-apply')
                ? 'bg-slate-800 text-cyan-300'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            How to Apply
          </Link>

          <Link
            to="/faq"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive('/faq')
                ? 'bg-slate-800 text-cyan-300'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            FAQ
          </Link>

          <a
            href="/tenant/portal.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800/60 hover:text-white"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Track App
          </a>

          <Link
            to="/how-it-works"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive('/how-it-works')
                ? 'bg-slate-800 text-cyan-300'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            For Landlords
          </Link>

          <Link
            to="/policies"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive('/policies')
                ? 'bg-slate-800 text-cyan-300'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            Policies
          </Link>
        </nav>

        {/* Right CTA */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            to="/apply"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Apply Online
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            to="/apply"
            className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
          >
            Apply
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:text-white focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div id="mobile-navigation-menu" className="md:hidden border-b border-slate-800 bg-slate-950 px-4 pt-2 pb-6 space-y-2" aria-label="Mobile navigation">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-slate-900"
          >
            Home
          </Link>
          <Link
            to="/listings"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-slate-900"
          >
            Browse Listings
          </Link>
          <Link
            to="/how-to-apply"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-slate-900"
          >
            How to Apply
          </Link>
          <Link
            to="/faq"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-slate-900"
          >
            FAQ
          </Link>
          <a
            href="/tenant/portal.html"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-slate-900"
          >
            Track Application
          </a>
          <Link
            to="/how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-slate-900"
          >
            For Landlords
          </Link>
          <Link
            to="/policies"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-lg px-3 py-2 text-base font-medium text-slate-200 hover:bg-slate-900"
          >
            Policy Framework
          </Link>
          <div className="pt-2">
            <Link
              to="/apply"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full rounded-xl bg-cyan-500 py-2.5 text-center font-semibold text-slate-950 shadow"
            >
              Start Rental Application
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
