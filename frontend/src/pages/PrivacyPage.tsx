import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function PrivacyPage() {
  return (
    <div id="privacy-page-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950 px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-400" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-cyan-300">Home</Link>
              <span>›</span>
              <Link to="/policies" className="hover:text-cyan-300">Policies</Link>
              <span>›</span>
              <span className="text-slate-200" aria-current="page">Privacy Policy</span>
            </nav>

            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              Data Protection &amp; Security
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-sm sm:text-base text-slate-300">
              How Choice Properties collects, safeguards, and handles personal applicant and landlord information.
            </p>
            <p className="text-xs text-slate-500">
              Effective Date: April 22, 2026 • Version 2.0
            </p>
          </div>
        </section>

        {/* Policy Body */}
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 space-y-6 leading-relaxed text-sm sm:text-base text-slate-300">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">1. Overview</h2>
              <p>
                Choice Properties ("we", "us", or "our") respects your personal privacy. This policy explains what information we collect when you explore our marketplace, submit rental applications, or interact with our landlord portals.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">2. Information We Collect</h2>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li><strong className="text-white">Applicant Intake:</strong> Full legal name, date of birth, email address, phone number, current and past residential addresses, employment history, and monthly income details.</li>
                <li><strong className="text-white">Social Security Information:</strong> To protect applicant confidentiality, full Social Security Numbers are never stored in plaintext across our primary databases. Verification is conducted through encrypted credit bureau channels.</li>
                <li><strong className="text-white">Supporting Documentation:</strong> Pay stubs, government IDs, and verification letters uploaded during the application process are transmitted via TLS 1.3 encryption.</li>
                <li><strong className="text-white">Technical &amp; Analytics Data:</strong> IP address, device type, browser metadata, and session cookies used exclusively to safeguard system integrity and prevent fraudulent bot submissions.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">3. How We Use Information</h2>
              <p>We process collected information solely for:</p>
              <ul className="list-disc pl-6 space-y-1 text-slate-300">
                <li>Verifying applicant identity and underwriting rental eligibility</li>
                <li>Facilitating secure communication between applicants and property owners</li>
                <li>Preparing digital lease documents and coordinating tenancy onboarding</li>
                <li>Complying with federal consumer reporting (FCRA) and Fair Housing requirements</li>
              </ul>
              <p className="text-emerald-400 font-semibold mt-2">
                We never sell, rent, or trade your personal information to third-party advertisers.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">4. Data Security</h2>
              <p>
                All data transmission between your browser and our servers is secured using modern TLS encryption. Sensitive applicant records are restricted to verified leasing staff with strict role-based access control (RBAC).
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">5. Your Privacy Rights</h2>
              <p>
                You have the right to request a copy of the personal information we hold about you, request corrections to inaccurate records, or request deletion of personal files subject to statutory legal retention mandates. To exercise your rights, contact <a href="mailto:support@choiceproperties.com" className="text-cyan-400 hover:underline">support@choiceproperties.com</a>.
              </p>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs text-slate-400 pt-4 border-t border-slate-850">
            <Link to="/terms" className="hover:text-cyan-300 flex items-center gap-1">
              ← View Terms of Service
            </Link>
            <Link to="/policies" className="hover:text-cyan-300 flex items-center gap-1">
              Complete Policy Framework →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
