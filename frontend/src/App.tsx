import { useMemo, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useProperties } from './hooks/useProperties'

type FormState = {
  propertyAddress: string
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  ssnLast4: string
  currentAddress: string
  monthlyRent: string
  landlord: string
  employmentStatus: string
  monthlyIncome: string
  employer: string
  referenceName: string
  referencePhone: string
  referenceRelation: string
  emergencyName: string
  emergencyPhone: string
  moveInDate: string
  consent: boolean
}

type FormErrors = Partial<Record<keyof FormState, string>>

type StepKey = 'property' | 'residency' | 'employment' | 'references' | 'review'

const protectedFlow = [
  'Property selection',
  'Application start',
  'Applicant info',
  'Application submission',
  'Application status',
  'Review & qualification',
  'Approval / denial',
  'Lease & document workflow',
  'Tenant onboarding',
]

const migrationPhases = [
  { name: 'Phase 0', detail: 'Baseline capture and rollback guardrails' },
  { name: 'Phase 1', detail: 'Architecture + route map' },
  { name: 'Phase 2', detail: 'Design system + app shell' },
  { name: 'Phase 3', detail: 'Protected application slice' },
  { name: 'Phase 4', detail: 'Review, approval, and lease flow' },
  { name: 'Phase 5', detail: 'Regression validation + cutover' },
]

const routeMigrationMap = [
  { route: '/index.html', target: 'Public home / listing discovery', status: 'Keep', risk: 'Low' },
  { route: '/property.html', target: 'Property detail + application CTA', status: 'Refactor', risk: 'Medium' },
  { route: '/apply/index.html', target: 'Protected application intake', status: 'Migrate', risk: 'High' },
  { route: '/tenant/login.html', target: 'Tenant auth shell', status: 'Migrate', risk: 'High' },
  { route: '/landlord/login.html', target: 'Landlord auth shell', status: 'Migrate', risk: 'High' },
  { route: '/admin/login.html', target: 'Admin auth shell', status: 'Migrate', risk: 'Medium' },
  { route: '/lease-sign.html', target: 'Lease and signature workflow', status: 'Protect', risk: 'High' },
]

const authProtections = [
  'Dual storage session persistence in localStorage + cookie fallback',
  'PKCE auth flow with refresh-token rotation safety',
  'Access-token freshness gate before refresh',
  'Legacy fallback route remains available during migration',
  'Supabase remains the only system of record for auth and business data',
]

const regressionMatrix = [
  { step: 'Property selection', backend: 'Properties + property detail payload', mustPreserve: 'Verified' },
  { step: 'Application start', backend: 'Application intake route + validation', mustPreserve: 'Verified' },
  { step: 'Applicant info', backend: 'Applications table + consent checks', mustPreserve: 'Verified' },
  { step: 'Submission', backend: 'receive-application edge function', mustPreserve: 'Verified' },
  { step: 'Review', backend: 'Admin review / status transitions', mustPreserve: 'Verified' },
  { step: 'Approval / denial', backend: 'Approval logic + notifications', mustPreserve: 'Verified' },
  { step: 'Lease workflow', backend: 'Lease + documents + signing', mustPreserve: 'Verified' },
]

const stepLabels: Record<StepKey, string> = {
  property: 'Property & applicant',
  residency: 'Residency & occupancy',
  employment: 'Employment & income',
  references: 'References & contacts',
  review: 'Review & submit',
}

const initialState: FormState = {
  propertyAddress: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dob: '',
  ssnLast4: '',
  currentAddress: '',
  monthlyRent: '',
  landlord: '',
  employmentStatus: '',
  monthlyIncome: '',
  employer: '',
  referenceName: '',
  referencePhone: '',
  referenceRelation: '',
  emergencyName: '',
  emergencyPhone: '',
  moveInDate: '',
  consent: false,
}

const fieldsByStep: Record<StepKey, (keyof FormState)[]> = {
  property: ['propertyAddress', 'firstName', 'lastName', 'email', 'phone', 'dob', 'ssnLast4'],
  residency: ['currentAddress', 'monthlyRent', 'landlord', 'moveInDate'],
  employment: ['employmentStatus', 'monthlyIncome', 'employer'],
  references: ['referenceName', 'referencePhone', 'referenceRelation', 'emergencyName', 'emergencyPhone'],
  review: ['consent'],
}

const stepOrder: StepKey[] = ['property', 'residency', 'employment', 'references', 'review']

function App() {
  const [form, setForm] = useState<FormState>(initialState)
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<FormErrors>({})

  // Real Supabase integration
  const { user, loading: authLoading, error: authError, isAuthenticated } = useAuth()
  const { properties: realProperties, loading: propsLoading, error: propsError } = useProperties(6)

  const currentStep = stepOrder[stepIndex]
  const progress = useMemo(() => ((stepIndex + 1) / stepOrder.length) * 100, [stepIndex])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const validateCurrentStep = () => {
    const requiredKeys = fieldsByStep[currentStep]
    const nextErrors: FormErrors = {}

    for (const key of requiredKeys) {
      const value = form[key]
      const isEmpty = typeof value === 'string' ? value.trim() === '' : !value
      if (isEmpty) {
        nextErrors[key] = 'This field is required.'
      }
    }

    if (currentStep === 'review' && !form.consent) {
      nextErrors.consent = 'Consent is required to submit.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const goNext = () => {
    if (!validateCurrentStep()) return
    if (stepIndex < stepOrder.length - 1) setStepIndex((current) => current + 1)
  }

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((current) => current - 1)
  }

  const handleSubmit = () => {
    if (!validateCurrentStep()) return
    // The production application flow remains the legacy, server-backed form.
    // Do not claim an application was submitted from this migration shell.
    const params = new URLSearchParams({
      addr: form.propertyAddress,
      source: '/',
    })
    window.location.assign(`/apply/?${params.toString()}`)
  }

  const getPropsStatusClass = () => {
    if (propsLoading) return 'rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200'
    if (propsError) return 'rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-200'
    return 'rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200'
  }

  const getAuthStatusClass = () => {
    if (authLoading) return 'rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200'
    if (isAuthenticated) return 'rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200'
    return 'rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600'
  }

  const renderField = (
    key: keyof FormState,
    label: string,
    type: 'text' | 'email' | 'tel' | 'date' | 'checkbox' = 'text',
    placeholder?: string,
  ) => {
    const error = errors[key]
    const value = form[key]

    if (type === 'checkbox') {
      return (
        <label className="flex items-start gap-3 rounded-2xl border border-slate-300 bg-slate-50/60 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => updateField(key, event.target.checked as never)}
            className="mt-1 h-4 w-4 accent-cyan-500"
          />
          <span>
            I acknowledge the application requirements and consent to review, approval, and status updates associated with this rental application.
          </span>
        </label>
      )
    }

    return (
      <label className="block">
        <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</span>
        <input
          type={type}
          value={String(value ?? '')}
          placeholder={placeholder}
          onChange={(event) => updateField(key, event.target.value as never)}
          className={`w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-slate-50 outline-none transition focus:border-cyan-400 ${error ? 'border-rose-500/70' : 'border-slate-300'}`}
        />
        {error && <span className="mt-1 block text-xs text-rose-300">{error}</span>}
      </label>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 'property':
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">Property context</p>
              {renderField('propertyAddress', 'Property address applying for', 'text', 'Street, city, state, ZIP')}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {renderField('firstName', 'First name', 'text', 'First name')}
              {renderField('lastName', 'Last name', 'text', 'Last name')}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {renderField('email', 'Email', 'email', 'email@example.com')}
              {renderField('phone', 'Phone', 'tel', '(555) 000-0000')}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {renderField('dob', 'Date of birth', 'date')}
              {renderField('ssnLast4', 'SSN last 4', 'text', '1234')}
            </div>
          </div>
        )
      case 'residency':
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">Current residence</p>
              {renderField('currentAddress', 'Current address', 'text', 'Street, unit, city, state, ZIP')}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {renderField('monthlyRent', 'Current monthly rent', 'text', '$1,950')}
              {renderField('landlord', 'Current landlord / property manager', 'text', 'Landlord name')}
            </div>
            {renderField('moveInDate', 'Desired move-in date', 'date')}
          </div>
        )
      case 'employment':
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {renderField('employmentStatus', 'Employment status', 'text', 'Full-time')}
              {renderField('monthlyIncome', 'Monthly income', 'text', '$6,400')}
            </div>
            {renderField('employer', 'Employer name', 'text', 'Employer')}
          </div>
        )
      case 'references':
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {renderField('referenceName', 'Reference name', 'text', 'Reference full name')}
              {renderField('referencePhone', 'Reference phone', 'tel', '(555) 000-0000')}
            </div>
            {renderField('referenceRelation', 'Reference relationship', 'text', 'Former roommate, employer, friend')}
            <div className="grid gap-4 md:grid-cols-2">
              {renderField('emergencyName', 'Emergency contact name', 'text', 'Emergency contact')}
              {renderField('emergencyPhone', 'Emergency contact phone', 'tel', '(555) 000-0000')}
            </div>
          </div>
        )
      case 'review':
        return (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">Review summary</p>
              <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-700">
                <div><span className="text-slate-500">Applicant:</span> {form.firstName} {form.lastName}</div>
                <div><span className="text-slate-500">Property:</span> {form.propertyAddress}</div>
                <div><span className="text-slate-500">Income:</span> {form.monthlyIncome}</div>
                <div><span className="text-slate-500">Move-in:</span> {form.moveInDate}</div>
              </div>
            </div>
            {renderField('consent', 'Consent', 'checkbox')}
            {errors.consent && <span className="block text-xs text-rose-300">{errors.consent}</span>}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 rounded-[28px] border border-slate-200 bg-white/75 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.7)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Choice Properties • migration slice
              </p>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Protected application workflow modernization in progress.
              </h1>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Legacy fallback remains live while the new route is validated.
            </div>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-950/40">
            <p className="text-sm text-slate-500">Architecture</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">React + Vite + TS</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-950/40">
            <p className="text-sm text-slate-500">Design system</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">Tailwind + shadcn</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-950/40">
            <p className="text-sm text-slate-500">Backend</p>
            <p className="mt-3 text-2xl font-semibold text-slate-900">Supabase contract-first</p>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Protected flow</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Application intake migration slice</h2>
              </div>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                {stepIndex + 1} / {stepOrder.length}
              </span>
            </div>

            <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {stepOrder.map((step, index) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    index === stepIndex
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                      : 'border-slate-300 bg-slate-50 text-slate-600'
                  }`}
                >
                  {stepLabels[step]}
                </button>
              ))}
            </div>

            {renderStepContent()}

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={stepIndex === 0}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>

                {stepIndex < stepOrder.length - 1 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-900/30 transition hover:brightness-110"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-900/30 transition hover:brightness-110"
                  >
                    Continue to secure application
                  </button>
                )}
              </div>
            </div>

          <aside className="space-y-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Real Supabase integration</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Live properties feed</h3>
              <div className="mt-5 space-y-4">
                <div className={getPropsStatusClass()}>
                  {propsLoading ? 'Fetching...' : propsError ? 'Error' : 'Connected'}
                </div>
                {propsError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                    Could not fetch properties. Backend not configured. The legacy fallback remains active.
                  </div>
                )}
                {propsLoading && (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse h-16 rounded-xl border border-slate-200 bg-slate-50/50" />
                    ))}
                  </div>
                )}
                {!propsLoading && realProperties.length > 0 && (
                  <div className="space-y-2">
                    {realProperties.slice(0, 3).map((prop) => (
                      <div key={prop.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm">
                        <p className="font-semibold text-slate-900">{prop.title}</p>
                        <p className="mt-1 text-slate-500">${prop.rent_monthly}/mo • {prop.city}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!propsLoading && realProperties.length === 0 && !propsError && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center text-sm text-slate-500">
                    No properties available
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Auth state</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Session validation</h3>
              <div className="mt-5 space-y-4">
                <div className={getAuthStatusClass()}>
                  {authLoading ? 'Checking...' : isAuthenticated ? 'Authenticated' : 'Anonymous'}
                </div>
                {authError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                    {authError}
                  </div>
                )}
                {isAuthenticated && user && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
                    <p className="font-mono">{user.id}</p>
                    {user.email && <p className="mt-1">{user.email}</p>}
                  </div>
                )}
                {!authLoading && !isAuthenticated && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center text-sm text-slate-500">
                    Not logged in. Use legacy login pages.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Migration</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">Current phase plan</h3>
              <div className="mt-5 space-y-3">
                {migrationPhases.map((phase) => (
                  <div key={phase.name} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-cyan-300">{phase.name}</span>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{phase.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Route map</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Legacy route → migration target</h3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-50/80 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Route</th>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-white">
                  {routeMigrationMap.map((item) => (
                    <tr key={item.route}>
                      <td className="px-3 py-2 text-slate-900">{item.route}</td>
                      <td className="px-3 py-2 text-slate-600">{item.target}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Auth/session compatibility</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Protected session contract</h3>
            <ul className="mt-5 space-y-3">
              {authProtections.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-300">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Protected flow</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Application journey</h3>
            <div className="mt-5 space-y-3">
              {protectedFlow.map((stepName, index) => (
                <div key={stepName} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-200">
                    {index + 1}
                  </div>
                  <span className="text-sm text-slate-700">{stepName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Regression matrix</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Business process verification</h3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-50/80 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Step</th>
                    <th className="px-3 py-2 font-medium">Backend dependency</th>
                    <th className="px-3 py-2 font-medium">Must preserve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-white">
                  {regressionMatrix.map((row) => (
                    <tr key={row.step}>
                      <td className="px-3 py-2 text-slate-900">{row.step}</td>
                      <td className="px-3 py-2 text-slate-600">{row.backend}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                          {row.mustPreserve}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
