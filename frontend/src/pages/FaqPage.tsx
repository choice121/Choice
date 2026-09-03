import { useState, useId } from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

interface FaqItem {
  id: string
  question: string
  answer: string
  category: 'applying' | 'fees' | 'tracking' | 'pets' | 'protections'
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-how-to-apply',
    category: 'applying',
    question: 'How do I apply for a property?',
    answer:
      'Click "Start Online Application" on any listing. The secure application takes about 10–15 minutes — you will need your government ID, proof of income (pay stubs or bank statements), and basic rental history. Nothing is charged when you initially submit your application. After submission, our leasing coordinators contact you within 24 hours to securely complete the standard $50 application screening fee.',
  },
  {
    id: 'faq-approval-time',
    category: 'applying',
    question: 'How long does the approval decision take?',
    answer:
      'Applications are typically processed within 24 to 72 hours once the $50 screening fee is finalized. Fast turnaround is prioritized for applicants who provide complete documentation (W-2s/pay stubs and photo ID). You will receive automated status emails at every step, and you can track real-time progress anytime via the Tenant Portal with your Application ID.',
  },
  {
    id: 'faq-qualification',
    category: 'applying',
    question: 'What are the general qualification requirements?',
    answer:
      'Standard qualification criteria require a verifiable monthly household income of approximately 3× the monthly rent, a passing background screening, no recent unresolved evictions, and acceptable credit history. We evaluate each application fairly and systematically under Equal Housing Opportunity standards.',
  },
  {
    id: 'faq-multiple-properties',
    category: 'applying',
    question: 'Can I apply for multiple properties simultaneously?',
    answer:
      'Yes. You may submit applications to multiple properties in our marketplace. Each separate property submission requires an individual screening review. If you are not selected for one property, your verified screening file may qualify for transfer credits under our Application Credit Policy.',
  },
  {
    id: 'faq-fee-policy',
    category: 'fees',
    question: 'Is the $50 application fee refundable?',
    answer:
      'The application fee is strictly fixed at $50 and covers actual third-party background, credit, and identity screening verification. The fee is non-refundable once payment has been processed and screening has commenced. If an application is not approved, you may be eligible for application credits toward another listing valid for 45 days.',
  },
  {
    id: 'faq-security-deposit',
    category: 'fees',
    question: 'What is the security deposit amount?',
    answer:
      'At Choice Properties, the security deposit is standardized at exactly 1× monthly rent across all verified listings. There are no surprise hidden move-in charges, junk fees, or inflated administrative costs.',
  },
  {
    id: 'faq-tracking',
    category: 'tracking',
    question: 'How do I track my submitted application?',
    answer:
      'You can check your live review status, submitted documents, and next steps anytime using our online Application Tracker in the Tenant Portal. Simply enter your Application ID and primary email address. You can also contact our team directly at 707-706-3137 or support@choiceproperties.com.',
  },
  {
    id: 'faq-pets',
    category: 'pets',
    question: 'Are pets allowed in Choice Properties rentals?',
    answer:
      'Yes! Choice Properties is proudly 100% pet-friendly across our inventory. Both dogs and cats are welcome. Any specific breed or weight guidelines are transparently stated on each property page, and reasonable accommodations for assistance animals are always supported without extra fees in accordance with the Fair Housing Act.',
  },
  {
    id: 'faq-protections',
    category: 'protections',
    question: 'What protections exist if the property differs from the listing?',
    answer:
      'Before lease signing: If a home materially differs from the verified listing description (such as incorrect specifications, missing amenities, or unit unavailability), you are eligible for fee credits or full review remediation. After lease signing: If an undisclosed habitability or safety defect is confirmed, we facilitate immediate remediation, unit transfer, or lease cancellation in accordance with our Complete Policy Framework.',
  },
  {
    id: 'faq-support',
    category: 'protections',
    question: 'How do I speak with a real leasing coordinator?',
    answer:
      'We believe in human service. You can call or text our direct line at 707-706-3137 (Monday – Saturday, 8:00 AM – 7:00 PM EST) or email support@choiceproperties.com. Inquiries submitted during business hours receive a same-day response.',
  },
]

const CATEGORIES = [
  { id: 'all', label: 'All Questions' },
  { id: 'applying', label: 'Applying & Qualifications' },
  { id: 'fees', label: 'Fees & Deposits' },
  { id: 'tracking', label: 'Status & Tracking' },
  { id: 'pets', label: 'Pet Friendly Policies' },
  { id: 'protections', label: 'Renter Protections' },
]

export function FaqPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'faq-how-to-apply': true,
    'faq-approval-time': true,
  })

  const searchInputId = useId()

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredItems = FAQ_ITEMS.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div id="faq-page-container" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section id="faq-hero-section" className="relative overflow-hidden border-b border-slate-200/80 bg-gradient-to-b from-slate-100 via-slate-950 to-slate-950 px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-4xl text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              Help Center &amp; Support
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
              Frequently Asked <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">Questions</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Transparent answers about our standard $50 application fee, 1× rent deposits, approval timelines, and renter protections.
            </p>

            {/* Live Search Box */}
            <div className="pt-4 max-w-xl mx-auto">
              <label htmlFor={searchInputId} className="sr-only">Search questions</label>
              <div className="relative">
                <input
                  id={searchInputId}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions (e.g. fee, pets, approval, deposit)..."
                  className="w-full rounded-2xl border border-slate-300 bg-white/90 px-5 py-3.5 pl-12 text-sm text-slate-900 placeholder-slate-400 shadow-inner outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
                <svg
                  className="absolute left-4 top-4 h-5 w-5 text-slate-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-3.5 text-xs text-slate-500 hover:text-slate-900"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section id="faq-content-section" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8 space-y-8">
          {/* Category Filter Pills */}
          <div id="faq-category-pills" className="flex flex-wrap gap-2 justify-center pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                id={`filter-cat-${cat.id}`}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition min-h-[40px] ${
                  selectedCategory === cat.id
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Accordion List */}
          <div id="faq-accordion-list" className="space-y-4">
            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 space-y-3">
                <p className="text-base font-semibold text-slate-700">No matching questions found</p>
                <p className="text-sm">Try searching with a different term, or reach out directly to our leasing desk.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedCategory('all')
                  }}
                  className="mt-2 inline-flex items-center rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-slate-700 transition"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isOpen = Boolean(openItems[item.id])
                return (
                  <div
                    key={item.id}
                    id={item.id}
                    className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/80 transition hover:border-slate-300"
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      aria-expanded={isOpen}
                      aria-controls={`${item.id}-answer`}
                      className="flex w-full items-center justify-between gap-4 p-5 sm:p-6 text-left transition hover:bg-slate-850"
                    >
                      <span className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        {item.question}
                      </span>
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition ${
                          isOpen
                            ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300 rotate-180'
                            : 'border-slate-300 bg-slate-100 text-slate-500'
                        }`}
                        aria-hidden="true"
                      >
                        ▼
                      </span>
                    </button>
                    {isOpen && (
                      <div
                        id={`${item.id}-answer`}
                        className="border-t border-slate-200/80 px-5 py-4 sm:px-6 text-sm sm:text-base leading-relaxed text-slate-600 space-y-3 bg-slate-50/40"
                      >
                        <p>{item.answer}</p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Assistance CTA Banner */}
          <div id="faq-support-banner" className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-100 via-white to-cyan-950/40 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-xl font-bold text-slate-900">Still have a question?</h3>
              <p className="text-sm text-slate-600 leading-relaxed max-w-lg">
                Our leasing desk is open Monday through Saturday to answer questions regarding property tours, applications, or leasing terms.
              </p>
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-cyan-300 justify-center md:justify-start">
                <a href="tel:7077063137" className="hover:underline flex items-center gap-1.5 font-medium">
                  📞 707-706-3137
                </a>
                <span className="text-slate-600">•</span>
                <a href="mailto:support@choiceproperties.com" className="hover:underline flex items-center gap-1.5 font-medium">
                  ✉️ support@choiceproperties.com
                </a>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                to="/listings"
                id="faq-browse-listings-cta"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-cyan-900/30 transition hover:brightness-110 min-h-[44px]"
              >
                Browse Listings
              </Link>
              <a
                href="/tenant/portal.html"
                target="_blank"
                rel="noopener noreferrer"
                id="faq-track-app-cta"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-700 hover:text-slate-900 min-h-[44px]"
              >
                Track Status
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
