import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function TermsPage() {
  return (
    <div id="terms-page-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-slate-200/80 bg-gradient-to-b from-slate-100 to-slate-950 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-zillow-blue">Home</Link>
              <span>›</span>
              <Link to="/policies" className="hover:text-zillow-blue">Policies</Link>
              <span>›</span>
              <span className="text-slate-700" aria-current="page">Terms of Service</span>
            </nav>

            <div className="inline-flex items-center gap-2 rounded-full border border-zillow-blue/30 bg-zillow-blue/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-zillow-blue">
              Platform Agreement
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              The binding legal terms and conditions governing the use of the Choice Properties rental platform.
            </p>
            <p className="text-xs text-slate-500">
              Effective Date: April 22, 2026 • Version 2.1
            </p>
          </div>
        </section>

        {/* Policy Body */}
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 sm:p-8 space-y-6 leading-relaxed text-sm sm:text-base text-slate-600">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">1. About Choice Properties</h2>
              <p>
                Choice Properties is an online rental marketplace facilitating connections between prospective tenants and verified independent landlords and property owners. We provide discovery tools, standardized application workflows, and lease execution management.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">2. Acceptance of Terms</h2>
              <p>
                By accessing or using the platform as a site visitor, rental applicant, or registered landlord, you agree to be bound by these Terms of Service, our Privacy Policy, and our Complete Policy Framework.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">3. Eligibility &amp; User Conduct</h2>
              <ul className="list-disc pl-6 space-y-1 text-slate-600">
                <li>You must be at least 18 years of age to submit an application or register as a property manager.</li>
                <li>All information provided in rental applications must be truthful, complete, and verifiable. Material misrepresentation constitutes grounds for immediate denial or lease termination.</li>
                <li>Users may not scrape, harvest, or republish listings or images without prior written authorization.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">4. Application Fees &amp; Deposits</h2>
              <p>
                Application screening fees are fixed at $50.00 and cover third-party background and credit verification expenses. Standard security deposits are equal to 1× monthly rent. Payments are securely processed and receipts issued electronically.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">5. Equal Housing &amp; Fair Housing</h2>
              <p>
                Choice Properties operates in strict compliance with the federal Fair Housing Act and corresponding state anti-discrimination laws. Discriminatory listings or unlawful selection criteria are strictly prohibited.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">6. Limitation of Liability &amp; Dispute Resolution</h2>
              <p>
                To the fullest extent permitted by law, Choice Properties shall not be liable for indirect, incidental, or consequential damages resulting from user disputes between landlords and tenants. Any controversy arising out of these terms shall be settled through binding individual arbitration under the rules of the American Arbitration Association.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 pt-4 border-t border-slate-850">
            <Link to="/privacy" className="hover:text-zillow-blue flex items-center gap-1">
              ← View Privacy Policy
            </Link>
            <Link to="/policies" className="hover:text-zillow-blue flex items-center gap-1">
              Complete Policy Framework →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
