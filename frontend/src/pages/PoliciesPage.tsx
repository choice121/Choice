import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

export function PoliciesPage() {
  const policies = [
    {
      title: 'Fair Housing Policy',
      description: 'Our strict compliance with the federal Fair Housing Act and state anti-discrimination statutes. Zero tolerance for discrimination.',
      path: '/fair-housing',
      tag: 'Equal Opportunity',
    },
    {
      title: 'Rental Application Policy',
      description: 'Detailed explanation of applicant qualification criteria, 24–72 hour review timelines, and the standard $50 screening fee.',
      path: '/rental-application-policy',
      tag: 'Screening',
    },
    {
      title: 'Holding Deposit Policy',
      description: 'Terms governing off-market reservations for approved applicants, 100% credit toward move-in costs, and refund conditions.',
      path: '/holding-deposit-policy',
      tag: 'Reservations',
    },
    {
      title: 'Privacy Policy',
      description: 'How applicant documents, income verification, and personal contact information are encrypted, protected, and handled.',
      path: '/privacy',
      tag: 'Data Security',
    },
    {
      title: 'Terms of Service',
      description: 'General platform terms, marketplace rules, landlord agreements, e-signature validity, and dispute resolution.',
      path: '/terms',
      tag: 'Platform Agreement',
    },
  ]

  return (
    <div id="policies-page-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <section className="border-b border-slate-200/80 bg-gradient-to-b from-slate-100 via-slate-950 to-slate-950 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#006AFF]/30 bg-[#006AFF]/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#006AFF]">
              Governance &amp; Trust
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
              Complete Policy Framework
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Clear, transparent rules protecting renters, property owners, and community partners across the Choice Properties marketplace.
            </p>
          </div>
        </section>

        {/* Policies Grid */}
        <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8 space-y-12">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {policies.map((p) => (
              <Link
                key={p.path}
                to={p.path}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-md transition hover:border-[#006AFF]/50 hover:bg-slate-850"
              >
                <div className="space-y-3">
                  <span className="inline-block rounded-md bg-[#006AFF]/10 border border-[#006AFF]/30 px-2.5 py-0.5 text-xs font-semibold text-[#006AFF]">
                    {p.tag}
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 group-hover:text-[#006AFF] transition">
                    {p.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {p.description}
                  </p>
                </div>
                <div className="pt-4 text-xs font-semibold text-[#006AFF] group-hover:translate-x-1 transition flex items-center gap-1">
                  Read full policy →
                </div>
              </Link>
            ))}
          </div>

          {/* Core Guarantees Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 space-y-6">
            <h3 className="text-2xl font-bold text-slate-900">Our 3 Core Market Guarantees</h3>
            <div className="grid gap-6 sm:grid-cols-3 text-sm text-slate-600">
              <div className="space-y-1.5 border-l-2 border-[#006AFF] pl-4">
                <h4 className="font-bold text-slate-900 text-base">Standard $50 Fee</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Never pay hidden up-charges or variable broker fees. Application screening is strictly fixed at $50.
                </p>
              </div>
              <div className="space-y-1.5 border-l-2 border-[#00AD71] pl-4">
                <h4 className="font-bold text-slate-900 text-base">1× Security Deposit</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Standard deposit is exactly equal to one month's rent across our entire marketplace.
                </p>
              </div>
              <div className="space-y-1.5 border-l-2 border-[#006AFF] pl-4">
                <h4 className="font-bold text-slate-900 text-base">100% Pet Friendly</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Dogs and cats are welcomed in every listing, with upfront pet guidance and no blanket exclusions.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
