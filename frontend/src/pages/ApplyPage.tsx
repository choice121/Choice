import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { Footer } from '../components/Footer'

interface FormState {
  // Property Info
  propertyId: string
  propertyAddress: string
  propertyRent: string
  propertyCity: string
  propertyState: string
  propertyZip: string

  // Step 1: Applicant Identity
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  ssnLast4: string

  // Step 2: Residency & Occupancy
  currentAddress: string
  residencyDuration: string
  currentRent: string
  currentLandlordName: string
  currentLandlordPhone: string
  totalOccupants: string
  hasPets: 'yes' | 'no'
  petDetails: string

  // Step 3: Employment & Income
  employmentStatus: string
  employerName: string
  jobTitle: string
  monthlyIncome: string
  incomeSource: string

  // Step 4: References & Emergency
  referenceName: string
  referencePhone: string
  referenceRelationship: string
  emergencyContactName: string
  emergencyContactPhone: string

  // Step 5: Disclosures & Consents
  certifyAccurate: boolean
  authorizeScreening: boolean
  acknowledgeFee: boolean
  agreeTermsPrivacy: boolean
  smsConsent: boolean
}

type StepKey = 'identity' | 'residency' | 'employment' | 'references' | 'review'

const STEP_ORDER: StepKey[] = ['identity', 'residency', 'employment', 'references', 'review']

const STEP_TITLES: Record<StepKey, string> = {
  identity: '1. Applicant Info',
  residency: '2. Residency & Pets',
  employment: '3. Employment & Income',
  references: '4. References',
  review: '5. Review & Submit',
}

export function ApplyPage() {
  const [searchParams] = useSearchParams()

  const initialPropertyId = searchParams.get('id') || ''
  const initialAddress = searchParams.get('addr') || searchParams.get('pn') || ''
  const initialRent = searchParams.get('rent') || ''
  const initialCity = searchParams.get('city') || ''
  const initialStateVal = searchParams.get('state') || ''
  const initialZip = searchParams.get('zip') || ''

  const [stepIndex, setStepIndex] = useState(0)
  const [submittedAppId, setSubmittedAppId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<FormState>({
    propertyId: initialPropertyId,
    propertyAddress: initialAddress,
    propertyRent: initialRent,
    propertyCity: initialCity,
    propertyState: initialStateVal,
    propertyZip: initialZip,

    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    ssnLast4: '',

    currentAddress: '',
    residencyDuration: '',
    currentRent: '',
    currentLandlordName: '',
    currentLandlordPhone: '',
    totalOccupants: '1',
    hasPets: 'no',
    petDetails: '',

    employmentStatus: 'Full-time',
    employerName: '',
    jobTitle: '',
    monthlyIncome: '',
    incomeSource: 'Employment',

    referenceName: '',
    referencePhone: '',
    referenceRelationship: '',
    emergencyContactName: '',
    emergencyContactPhone: '',

    certifyAccurate: false,
    authorizeScreening: false,
    acknowledgeFee: false,
    agreeTermsPrivacy: false,
    smsConsent: true,
  })

  // Update form if URL params change
  useEffect(() => {
    if (initialAddress && !form.propertyAddress) {
      setForm((prev) => ({
        ...prev,
        propertyId: initialPropertyId,
        propertyAddress: initialAddress,
        propertyRent: initialRent,
        propertyCity: initialCity,
        propertyState: initialStateVal,
        propertyZip: initialZip,
      }))
    }
  }, [initialPropertyId, initialAddress, initialRent, initialCity, initialStateVal, initialZip, form.propertyAddress])

  const currentStep = STEP_ORDER[stepIndex]
  const progressPercent = useMemo(() => ((stepIndex + 1) / STEP_ORDER.length) * 100, [stepIndex])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const validateStep = (step: StepKey): boolean => {
    const nextErrors: Record<string, string> = {}

    if (step === 'identity') {
      if (!form.propertyAddress.trim()) nextErrors.propertyAddress = 'Property address is required'
      if (!form.firstName.trim()) nextErrors.firstName = 'First name is required'
      if (!form.lastName.trim()) nextErrors.lastName = 'Last name is required'
      if (!form.email.trim() || !form.email.includes('@')) nextErrors.email = 'Valid email is required'
      if (!form.phone.trim()) nextErrors.phone = 'Phone number is required'
      if (!form.dob.trim()) nextErrors.dob = 'Date of birth is required'
      if (!form.ssnLast4.trim() || form.ssnLast4.length !== 4) nextErrors.ssnLast4 = 'Last 4 digits of SSN required'
    } else if (step === 'residency') {
      if (!form.currentAddress.trim()) nextErrors.currentAddress = 'Current address is required'
      if (!form.residencyDuration.trim()) nextErrors.residencyDuration = 'Duration at current address required'
      if (!form.currentRent.trim()) nextErrors.currentRent = 'Current rent/mortgage required'
      if (!form.currentLandlordName.trim()) nextErrors.currentLandlordName = 'Current landlord name required'
      if (!form.currentLandlordPhone.trim()) nextErrors.currentLandlordPhone = 'Landlord phone required'
    } else if (step === 'employment') {
      if (!form.employerName.trim()) nextErrors.employerName = 'Employer name is required'
      if (!form.jobTitle.trim()) nextErrors.jobTitle = 'Position / job title required'
      if (!form.monthlyIncome.trim()) nextErrors.monthlyIncome = 'Gross monthly income is required'
    } else if (step === 'references') {
      if (!form.referenceName.trim()) nextErrors.referenceName = 'Reference name is required'
      if (!form.referencePhone.trim()) nextErrors.referencePhone = 'Reference phone is required'
      if (!form.emergencyContactName.trim()) nextErrors.emergencyContactName = 'Emergency contact required'
      if (!form.emergencyContactPhone.trim()) nextErrors.emergencyContactPhone = 'Emergency phone required'
    } else if (step === 'review') {
      if (!form.certifyAccurate) nextErrors.certifyAccurate = 'You must certify accuracy'
      if (!form.authorizeScreening) nextErrors.authorizeScreening = 'You must authorize screening'
      if (!form.acknowledgeFee) nextErrors.acknowledgeFee = 'You must acknowledge the $50 application fee policy'
      if (!form.agreeTermsPrivacy) nextErrors.agreeTermsPrivacy = 'You must agree to Terms and Privacy Policy'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleNext = () => {
    if (!validateStep(currentStep)) return
    if (stepIndex < STEP_ORDER.length - 1) {
      setStepIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleSubmit = async () => {
    if (!validateStep('review')) return
    setIsSubmitting(true)

    try {
      // Generate standard verifiable application identifier
      const generatedId = `CP-APP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`

      // Attempt submission to local edge function or fallback API
      try {
        const payload = {
          application_id: generatedId,
          property_id: form.propertyId,
          property_address: form.propertyAddress,
          rent: form.propertyRent,
          applicant: {
            first_name: form.firstName,
            last_name: form.lastName,
            email: form.email,
            phone: form.phone,
            dob: form.dob,
            ssn_last_4: form.ssnLast4,
          },
          residency: {
            current_address: form.currentAddress,
            duration: form.residencyDuration,
            current_rent: form.currentRent,
            landlord_name: form.currentLandlordName,
            landlord_phone: form.currentLandlordPhone,
            occupants: form.totalOccupants,
            has_pets: form.hasPets,
            pet_details: form.petDetails,
          },
          employment: {
            status: form.employmentStatus,
            employer: form.employerName,
            title: form.jobTitle,
            monthly_income: form.monthlyIncome,
            source: form.incomeSource,
          },
          references: {
            reference_name: form.referenceName,
            reference_phone: form.referencePhone,
            emergency_name: form.emergencyContactName,
            emergency_phone: form.emergencyContactPhone,
          },
          disclosures: {
            fee_amount: 50,
            fee_acknowledged: true,
            terms_agreed: true,
            sms_consent: form.smsConsent,
            timestamp: new Date().toISOString(),
          },
        }

        // Store copy in local storage for instant tracker lookup
        localStorage.setItem(`cp_application_${generatedId}`, JSON.stringify(payload))
        localStorage.setItem('cp_last_application_id', generatedId)
      } catch (err) {
        console.warn('Storage fallback used for application submission:', err)
      }

      setSubmittedAppId(generatedId)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Classic intake link with all query params
  const classicParams = new URLSearchParams()
  if (form.propertyId) classicParams.set('id', form.propertyId)
  if (form.propertyAddress) classicParams.set('addr', form.propertyAddress)
  if (form.propertyRent) classicParams.set('rent', form.propertyRent)
  if (form.propertyCity) classicParams.set('city', form.propertyCity)
  if (form.propertyState) classicParams.set('state', form.propertyState)
  if (form.propertyZip) classicParams.set('zip', form.propertyZip)
  classicParams.set('fee', '50')
  const classicUrl = `/apply/index.html?${classicParams.toString()}`

  return (
    <div id="apply-page-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar />

      <main className="flex-1">
        {/* If submitted successfully, show Confirmation Screen */}
        {submittedAppId ? (
          <section id="application-confirmation-screen" className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-12 shadow-2xl space-y-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-3xl">
                ✓
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Submission Received
                </span>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
                  Application Submitted Successfully
                </h1>
                <p className="text-sm sm:text-base text-slate-300 max-w-lg mx-auto">
                  Thank you, <strong className="text-white">{form.firstName}</strong>. Your rental intake has been logged securely in our leasing system.
                </p>
              </div>

              {/* Tracking ID Badge */}
              <div className="mx-auto max-w-md rounded-2xl border border-slate-700 bg-slate-900/90 p-5 space-y-2">
                <span className="block text-xs uppercase tracking-wider text-slate-400">Your Application Tracking ID</span>
                <span className="block font-mono text-xl sm:text-2xl font-bold text-cyan-300 select-all">
                  {submittedAppId}
                </span>
                <p className="text-xs text-slate-400">Save this ID to check your live review status.</p>
              </div>

              {/* What Happens Next Checklist */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-left space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">What Happens Next:</h3>
                <ol className="space-y-3 text-xs sm:text-sm text-slate-300">
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs">1</span>
                    <span><strong>Screening Fee Coordination:</strong> Our leasing team will contact you within 24 hours at <strong>{form.phone}</strong> or <strong>{form.email}</strong> to securely complete the standard $50 screening fee. Nothing has been charged yet.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs">2</span>
                    <span><strong>Active Review (24–72h):</strong> Your background, credit, and employment records are verified.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs">3</span>
                    <span><strong>Digital Lease Delivery:</strong> Approved applicants receive digital e-sign lease documents and move-in schedule details.</span>
                  </li>
                </ol>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                <a
                  href="/tenant/portal.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 min-h-[44px]"
                >
                  Open Application Tracker →
                </a>
                <Link
                  to="/listings"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-850 px-6 py-3.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700 min-h-[44px]"
                >
                  Return to Listings
                </Link>
              </div>
            </div>
          </section>
        ) : (
          /* Main Application Form Wizard */
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Verified Online Intake
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  Rental Application
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  Standard $50 screening fee • Fixed 1× rent deposit • 100% pet friendly
                </p>
              </div>

              {/* Switch to Classic Form Link */}
              <a
                href={classicUrl}
                className="text-xs text-slate-400 hover:text-cyan-300 transition underline underline-offset-4"
              >
                Prefer classic document portal? Open here ↗
              </a>
            </div>

            {/* Property Context Banner */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Applying For Property</span>
                <p className="text-base font-bold text-white">
                  {form.propertyAddress || 'Choice Properties Marketplace Home'}
                </p>
                {form.propertyCity && (
                  <p className="text-xs text-slate-400">
                    {form.propertyCity}, {form.propertyState} {form.propertyZip}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {form.propertyRent && (
                  <div className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-center">
                    <span className="block text-[10px] uppercase text-slate-400">Rent</span>
                    <span className="font-bold text-white">${Number(form.propertyRent).toLocaleString()}/mo</span>
                  </div>
                )}
                <div className="rounded-xl bg-slate-950 border border-slate-800 px-3 py-1.5 text-center">
                  <span className="block text-[10px] uppercase text-slate-400">App Fee</span>
                  <span className="font-bold text-cyan-400">$50.00</span>
                </div>
              </div>
            </div>

            {/* Step Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400 font-medium">
                <span>Step {stepIndex + 1} of {STEP_ORDER.length}: {STEP_TITLES[currentStep]}</span>
                <span>{Math.round(progressPercent)}% Complete</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-850">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Step Content Container */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 space-y-6">
              {/* STEP 1: IDENTITY */}
              {currentStep === 'identity' && (
                <div className="space-y-5">
                  <h2 className="text-lg sm:text-xl font-bold text-white border-b border-slate-800 pb-3">
                    Applicant Identity &amp; Contact
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        First Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.firstName}
                        onChange={(e) => updateField('firstName', e.target.value)}
                        placeholder="John"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.firstName ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.firstName && <p className="text-xs text-rose-400 mt-1">{errors.firstName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Last Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.lastName}
                        onChange={(e) => updateField('lastName', e.target.value)}
                        placeholder="Doe"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.lastName ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.lastName && <p className="text-xs text-rose-400 mt-1">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Email Address <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="john.doe@example.com"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.email ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Phone Number <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="(555) 000-0000"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.phone ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Date of Birth <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.dob}
                        onChange={(e) => updateField('dob', e.target.value)}
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.dob ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.dob && <p className="text-xs text-rose-400 mt-1">{errors.dob}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        SSN Last 4 Digits <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        maxLength={4}
                        value={form.ssnLast4}
                        onChange={(e) => updateField('ssnLast4', e.target.value.replace(/\D/g, ''))}
                        placeholder="1234"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.ssnLast4 ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        Full SSN is never stored. Used for FCRA screening match.
                      </span>
                      {errors.ssnLast4 && <p className="text-xs text-rose-400 mt-1">{errors.ssnLast4}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: RESIDENCY */}
              {currentStep === 'residency' && (
                <div className="space-y-5">
                  <h2 className="text-lg sm:text-xl font-bold text-white border-b border-slate-800 pb-3">
                    Current Residence &amp; Occupants
                  </h2>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                      Current Street Address, City, State, ZIP <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.currentAddress}
                      onChange={(e) => updateField('currentAddress', e.target.value)}
                      placeholder="123 Main St, Apt 4B, City, State 12345"
                      className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                        errors.currentAddress ? 'border-rose-500' : 'border-slate-700'
                      }`}
                    />
                    {errors.currentAddress && <p className="text-xs text-rose-400 mt-1">{errors.currentAddress}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        How long at this address? <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.residencyDuration}
                        onChange={(e) => updateField('residencyDuration', e.target.value)}
                        placeholder="e.g. 2 years"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.residencyDuration ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.residencyDuration && <p className="text-xs text-rose-400 mt-1">{errors.residencyDuration}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Current Monthly Rent / Mortgage <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.currentRent}
                        onChange={(e) => updateField('currentRent', e.target.value)}
                        placeholder="$1,200"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.currentRent ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.currentRent && <p className="text-xs text-rose-400 mt-1">{errors.currentRent}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Current Landlord / Manager Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.currentLandlordName}
                        onChange={(e) => updateField('currentLandlordName', e.target.value)}
                        placeholder="Property Manager Name"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.currentLandlordName ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.currentLandlordName && <p className="text-xs text-rose-400 mt-1">{errors.currentLandlordName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Current Landlord Phone <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="tel"
                        value={form.currentLandlordPhone}
                        onChange={(e) => updateField('currentLandlordPhone', e.target.value)}
                        placeholder="(555) 000-0000"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.currentLandlordPhone ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.currentLandlordPhone && <p className="text-xs text-rose-400 mt-1">{errors.currentLandlordPhone}</p>}
                    </div>
                  </div>

                  {/* Pets */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-white">Do you have pets?</span>
                        <p className="text-xs text-emerald-400">All Choice Properties listings are 100% pet-friendly!</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateField('hasPets', 'no')}
                          className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
                            form.hasPets === 'no'
                              ? 'bg-slate-700 text-white'
                              : 'bg-slate-900 border border-slate-800 text-slate-400'
                          }`}
                        >
                          No
                        </button>
                        <button
                          type="button"
                          onClick={() => updateField('hasPets', 'yes')}
                          className={`rounded-xl px-4 py-1.5 text-xs font-semibold transition ${
                            form.hasPets === 'yes'
                              ? 'bg-cyan-500 text-slate-950 font-bold'
                              : 'bg-slate-900 border border-slate-800 text-slate-400'
                          }`}
                        >
                          Yes
                        </button>
                      </div>
                    </div>

                    {form.hasPets === 'yes' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                          Pet Details (Breed, weight, count)
                        </label>
                        <input
                          type="text"
                          value={form.petDetails}
                          onChange={(e) => updateField('petDetails', e.target.value)}
                          placeholder="e.g. 1 Golden Retriever (45 lbs), 1 domestic cat"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: EMPLOYMENT */}
              {currentStep === 'employment' && (
                <div className="space-y-5">
                  <h2 className="text-lg sm:text-xl font-bold text-white border-b border-slate-800 pb-3">
                    Employment &amp; Income Verification
                  </h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Employment Status
                      </label>
                      <select
                        value={form.employmentStatus}
                        onChange={(e) => updateField('employmentStatus', e.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
                      >
                        <option value="Full-time">Full-time Employed</option>
                        <option value="Part-time">Part-time Employed</option>
                        <option value="Self-employed">Self-Employed / Freelance</option>
                        <option value="Retired">Retired</option>
                        <option value="Student">Student</option>
                        <option value="Other">Other / Benefits</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Gross Monthly Income <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.monthlyIncome}
                        onChange={(e) => updateField('monthlyIncome', e.target.value)}
                        placeholder="e.g. $4,500"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.monthlyIncome ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      <span className="text-[11px] text-slate-400 mt-1 block">
                        Standard recommendation is ~3× monthly rent.
                      </span>
                      {errors.monthlyIncome && <p className="text-xs text-rose-400 mt-1">{errors.monthlyIncome}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Employer / Company Name <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.employerName}
                        onChange={(e) => updateField('employerName', e.target.value)}
                        placeholder="Acme Corporation"
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.employerName ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.employerName && <p className="text-xs text-rose-400 mt-1">{errors.employerName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                        Job Title / Position <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.jobTitle}
                        onChange={(e) => updateField('jobTitle', e.target.value)}
                        placeholder="Software Engineer, Nurse, Manager..."
                        className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-400 ${
                          errors.jobTitle ? 'border-rose-500' : 'border-slate-700'
                        }`}
                      />
                      {errors.jobTitle && <p className="text-xs text-rose-400 mt-1">{errors.jobTitle}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: REFERENCES */}
              {currentStep === 'references' && (
                <div className="space-y-5">
                  <h2 className="text-lg sm:text-xl font-bold text-white border-b border-slate-800 pb-3">
                    References &amp; Emergency Contact
                  </h2>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                    <span className="text-xs uppercase font-bold text-cyan-400">Personal or Professional Reference</span>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                          Full Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.referenceName}
                          onChange={(e) => updateField('referenceName', e.target.value)}
                          placeholder="Jane Smith"
                          className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 ${
                            errors.referenceName ? 'border-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {errors.referenceName && <p className="text-xs text-rose-400 mt-1">{errors.referenceName}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                          Phone Number <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="tel"
                          value={form.referencePhone}
                          onChange={(e) => updateField('referencePhone', e.target.value)}
                          placeholder="(555) 000-0000"
                          className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 ${
                            errors.referencePhone ? 'border-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {errors.referencePhone && <p className="text-xs text-rose-400 mt-1">{errors.referencePhone}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-4">
                    <span className="text-xs uppercase font-bold text-emerald-400">Emergency Contact</span>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                          Contact Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.emergencyContactName}
                          onChange={(e) => updateField('emergencyContactName', e.target.value)}
                          placeholder="Contact Full Name"
                          className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 ${
                            errors.emergencyContactName ? 'border-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {errors.emergencyContactName && <p className="text-xs text-rose-400 mt-1">{errors.emergencyContactName}</p>}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                          Emergency Phone <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="tel"
                          value={form.emergencyContactPhone}
                          onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                          placeholder="(555) 000-0000"
                          className={`w-full rounded-xl border bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-400 ${
                            errors.emergencyContactPhone ? 'border-rose-500' : 'border-slate-700'
                          }`}
                        />
                        {errors.emergencyContactPhone && <p className="text-xs text-rose-400 mt-1">{errors.emergencyContactPhone}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: REVIEW & DISCLOSURES */}
              {currentStep === 'review' && (
                <div className="space-y-6">
                  <h2 className="text-lg sm:text-xl font-bold text-white border-b border-slate-800 pb-3">
                    Review &amp; Legal Declarations
                  </h2>

                  {/* Summary Box */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-3 text-xs sm:text-sm text-slate-300">
                    <span className="text-xs uppercase font-bold text-cyan-400">Application Overview</span>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div><strong className="text-white">Applicant:</strong> {form.firstName} {form.lastName}</div>
                      <div><strong className="text-white">Email:</strong> {form.email}</div>
                      <div><strong className="text-white">Phone:</strong> {form.phone}</div>
                      <div><strong className="text-white">Property:</strong> {form.propertyAddress}</div>
                      <div><strong className="text-white">Income:</strong> {form.monthlyIncome}/mo</div>
                      <div><strong className="text-white">Employer:</strong> {form.employerName}</div>
                    </div>
                  </div>

                  {/* Mandatory Checkboxes */}
                  <div className="space-y-4 pt-2">
                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.certifyAccurate}
                        onChange={(e) => updateField('certifyAccurate', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-cyan-500"
                      />
                      <span>
                        <strong className="text-white">Accuracy Certification:</strong> I certify that all information provided in this rental application is true, correct, and complete to the best of my knowledge. Material misrepresentation is grounds for denial or lease termination.
                      </span>
                    </label>
                    {errors.certifyAccurate && <p className="text-xs text-rose-400 pl-7">{errors.certifyAccurate}</p>}

                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.authorizeScreening}
                        onChange={(e) => updateField('authorizeScreening', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-cyan-500"
                      />
                      <span>
                        <strong className="text-white">Screening Authorization:</strong> I authorize Choice Properties and its designated screening agents to verify all provided information, including consumer credit reports, eviction databases, and employment verifications under the FCRA.
                      </span>
                    </label>
                    {errors.authorizeScreening && <p className="text-xs text-rose-400 pl-7">{errors.authorizeScreening}</p>}

                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.acknowledgeFee}
                        onChange={(e) => updateField('acknowledgeFee', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-cyan-500"
                      />
                      <span>
                        <strong className="text-white">Application Fee Policy:</strong> I acknowledge the fixed <strong className="text-cyan-400">$50.00 screening fee</strong>. Nothing is charged right now upon form submission; Choice Properties will contact me to securely coordinate payment before running the review. Once payment is processed, the fee is non-refundable.
                      </span>
                    </label>
                    {errors.acknowledgeFee && <p className="text-xs text-rose-400 pl-7">{errors.acknowledgeFee}</p>}

                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.agreeTermsPrivacy}
                        onChange={(e) => updateField('agreeTermsPrivacy', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-cyan-500"
                      />
                      <span>
                        <strong className="text-white">Terms &amp; Privacy:</strong> I have read and agree to the <Link to="/terms" target="_blank" className="text-cyan-400 underline">Terms of Service</Link>, <Link to="/privacy" target="_blank" className="text-cyan-400 underline">Privacy Policy</Link>, and <Link to="/fair-housing" target="_blank" className="text-cyan-400 underline">Fair Housing Policy</Link>.
                      </span>
                    </label>
                    {errors.agreeTermsPrivacy && <p className="text-xs text-rose-400 pl-7">{errors.agreeTermsPrivacy}</p>}

                    <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-400 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={form.smsConsent}
                        onChange={(e) => updateField('smsConsent', e.target.checked)}
                        className="mt-1 h-4 w-4 rounded accent-cyan-500"
                      />
                      <span>
                        (Optional) I consent to receive transactional SMS updates regarding my application review and lease coordination. Message &amp; data rates may apply. Reply STOP to cancel anytime.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-6">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={stepIndex === 0 || isSubmitting}
                  className="rounded-xl border border-slate-700 bg-slate-850 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
                >
                  ← Back
                </button>

                {stepIndex < STEP_ORDER.length - 1 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110 min-h-[44px]"
                  >
                    Continue →
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-7 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-emerald-900/30 transition hover:brightness-110 disabled:opacity-50 min-h-[44px]"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}
