import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 lg:gap-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-600 text-white shadow">
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
              <span className="text-base font-bold text-white">Choice Properties</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Nationwide rental property marketplace offering transparent pricing, standard $50
              application fees, and 100% pet-friendly housing across major metro markets.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              <span>Equal Housing Opportunity</span>
            </div>
          </div>

          {/* Col 2: Renters */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              For Renters
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link to="/listings" className="hover:text-cyan-300 transition">
                  Browse All Listings
                </Link>
              </li>
              <li>
                <a href="/how-to-apply.html" className="hover:text-cyan-300 transition">
                  How to Apply
                </a>
              </li>
              <li>
                <a href="/apply/" className="hover:text-cyan-300 transition">
                  Start Application ($50 fee)
                </a>
              </li>
              <li>
                <a href="/tenant/portal.html" className="hover:text-cyan-300 transition">
                  Track Application Status
                </a>
              </li>
              <li>
                <a href="/faq.html" className="hover:text-cyan-300 transition">
                  Renter FAQ & Support
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Landlords */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              For Landlords
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="/landlord/register.html" className="hover:text-cyan-300 transition">
                  Landlord Registration
                </a>
              </li>
              <li>
                <a href="/landlord/login.html" className="hover:text-cyan-300 transition">
                  Landlord Portal Login
                </a>
              </li>
              <li>
                <a href="/how-it-works.html" className="hover:text-cyan-300 transition">
                  Platform Overview
                </a>
              </li>
              <li>
                <a href="/landlord-platform-agreement.html" className="hover:text-cyan-300 transition">
                  Platform Agreement
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4: Trust & Policies */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Legal & Trust
            </h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a href="/rental-application-policy.html" className="hover:text-cyan-300 transition">
                  Rental Application Policy
                </a>
              </li>
              <li>
                <a href="/holding-deposit-policy.html" className="hover:text-cyan-300 transition">
                  Holding Deposit Policy
                </a>
              </li>
              <li>
                <a href="/fair-housing.html" className="hover:text-cyan-300 transition">
                  Fair Housing Commitment
                </a>
              </li>
              <li>
                <a href="/terms.html" className="hover:text-cyan-300 transition">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/privacy.html" className="hover:text-cyan-300 transition">
                  Privacy Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-900 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Choice Properties. All rights reserved.</p>
          <div className="flex gap-4">
            <span>Standard $50 Application Fee</span>
            <span>•</span>
            <span>Always Pet Friendly</span>
            <span>•</span>
            <a href="mailto:support@choiceproperties.com" className="hover:text-slate-400">
              support@choiceproperties.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
