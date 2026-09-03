import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer aria-label="Site footer" className="border-t border-slate-200 bg-slate-50 text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zillow-blue text-white shadow-sm">
                <svg
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
              <span className="text-base font-bold text-slate-900">Choice Properties</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500">
              Nationwide rental property marketplace offering transparent pricing, standard $50
              application fees, and 100% pet-friendly housing across major metro markets.
            </p>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-zillow-green" />
              <span>Equal Housing Opportunity</span>
            </div>
          </div>

          {/* Col 2: Renters */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              For Renters
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/listings" className="text-slate-600 hover:text-slate-900 transition">
                  Browse All Listings
                </Link>
              </li>
              <li>
                <Link to="/how-to-apply" className="text-slate-600 hover:text-slate-900 transition">
                  How to Apply
                </Link>
              </li>
              <li>
                <Link to="/apply" className="text-slate-600 hover:text-slate-900 transition">
                  Start Application ($50 fee)
                </Link>
              </li>
              <li>
                <a href="/tenant/portal.html" className="text-slate-600 hover:text-slate-900 transition">
                  Track Application Status
                </a>
              </li>
              <li>
                <Link to="/faq" className="text-slate-600 hover:text-slate-900 transition">
                  Renter FAQ &amp; Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Portals */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Portals
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="/landlord/register.html" className="text-slate-600 hover:text-slate-900 transition">
                  Landlord Registration
                </a>
              </li>
              <li>
                <a href="/landlord/login.html" className="text-slate-600 hover:text-slate-900 transition">
                  Landlord Portal Login
                </a>
              </li>
              <li>
                <a href="/admin/login.html" className="text-slate-600 hover:text-slate-900 transition">
                  Admin Portal Login
                </a>
              </li>
              <li>
                <Link to="/how-it-works" className="text-slate-600 hover:text-slate-900 transition">
                  Platform Overview
                </Link>
              </li>
              <li>
                <a href="/landlord-platform-agreement.html" className="text-slate-600 hover:text-slate-900 transition">
                  Platform Agreement
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Trust & Policies */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
              Legal &amp; Trust
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/policies" className="text-slate-900 font-semibold hover:text-slate-700 transition">
                  Complete Policy Framework
                </Link>
              </li>
              <li>
                <Link to="/rental-application-policy" className="text-slate-600 hover:text-slate-900 transition">
                  Rental Application Policy
                </Link>
              </li>
              <li>
                <Link to="/holding-deposit-policy" className="text-slate-600 hover:text-slate-900 transition">
                  Holding Deposit Policy
                </Link>
              </li>
              <li>
                <Link to="/fair-housing" className="text-slate-600 hover:text-slate-900 transition">
                  Fair Housing Commitment
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-slate-600 hover:text-slate-900 transition">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-slate-600 hover:text-slate-900 transition">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Choice Properties. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
            <span>Standard $50 Application Fee</span>
            <span className="hidden sm:inline">•</span>
            <span>Always Pet Friendly</span>
            <span className="hidden sm:inline">•</span>
            <a href="mailto:support@choiceproperties.com" className="hover:text-slate-900 transition">
              support@choiceproperties.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
