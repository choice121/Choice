import { useMemo, useState } from 'react'

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

const contractGuardrails = [
  'Keep Supabase as the system of record',
  'Preserve edge-function validation exactly',
  'Never rewrite core business logic during UI modernization',
  'Use route-by-route fallback so legacy pages remain available',
]

const appFormSnapshot = [
  'First name / last name',
  'DOB + phone + email',
  'Current address + landlord history',
  'Employment + income details',
  'References + emergency contact',
  'Consent + application submission',
]

const statusStates = [
  { label: 'Pending', tone: 'bg-amber-500/15 text-amber-200 border-amber-500/40' },
  { label: 'Under review', tone: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40' },
  { label: 'Approved', tone: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40' },
  { label: 'Denied', tone: 'bg-rose-500/15 text-rose-200 border-rose-500/40' },
  { label: 'Lease in progress', tone: 'bg-violet-500/15 text-violet-200 border-violet-500/40' },
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

type FormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  dob: string
  consent: boolean
}

const initialFormState: FormState = {
  firstName: 'Jordan',
  lastName: 'Smith',
  email: 'jordan@example.com',
  phone: '(555) 201-1042',
  dob: '1992-04-15',
  consent: true,
}

function App() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>(initialFormState)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const progress = useMemo(() => (step / 3) * 100, [step])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 rounded-[28px] border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_80px_rgba(2,6,23,0.7)] backdrop-blur sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Choice Properties • migration slice
              </p>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Protected application workflow modernization in progress.
              </h1>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Legacy fallback remains live while the new route is validated.
            </div>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-slate-950/40">
            <p className="text-sm text-slate-400">Architecture</p>
            <p className="mt-3 text-2xl font-semibold text-white">React + Vite + TS</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-slate-950/40">
            <p className="text-sm text-slate-400">Design system</p>
            <p className="mt-3 text-2xl font-semibold text-white">Tailwind + shadcn</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-lg shadow-slate-950/40">
            <p className="text-sm text-slate-400">Backend</p>
            <p className="mt-3 text-2xl font-semibold text-white">Supabase contract-first</p>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Protected flow</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Application intake migration shell</h2>
              </div>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                Step {step} / 3
              </span>
            </div>

            <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>

            {isSubmitted ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-100">
                <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">Submission status</p>
                <h3 className="mt-3 text-2xl font-semibold text-white">Application received</h3>
                <p className="mt-2 text-sm text-emerald-100/90">
                  This demonstrates the success state that must remain compatible with the current backend submission contract.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSubmitted(false)}
                  className="mt-5 rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20"
                >
                  Review form again
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">First name</span>
                        <input
                          value={form.firstName}
                          onChange={(event) => updateField('firstName', event.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Last name</span>
                        <input
                          value={form.lastName}
                          onChange={(event) => updateField('lastName', event.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Email</span>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(event) => updateField('email', event.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Phone</span>
                        <input
                          value={form.phone}
                          onChange={(event) => updateField('phone', event.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Date of birth</span>
                      <input
                        type="date"
                        value={form.dob}
                        onChange={(event) => updateField('dob', event.target.value)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none transition focus:border-cyan-400"
                      />
                    </label>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-400">Current housing history</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Current address</span>
                          <input
                            value="2145 Lakeview Ave"
                            readOnly
                            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Monthly rent</span>
                          <input value="$1,950" readOnly className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none" />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Landlord name</span>
                          <input value="Northwind Realty" readOnly className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none" />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-400">Employment & income</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Employment status</span>
                          <input value="Full-time" readOnly className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none" />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-[11px] uppercase tracking-[0.14em] text-slate-400">Monthly income</span>
                          <input value="$6,400" readOnly className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-slate-100 outline-none" />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-400">Consent & submission</p>
                      <label className="flex items-start gap-3 rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={form.consent}
                          onChange={(event) => updateField('consent', event.target.checked)}
                          className="mt-1 h-4 w-4 accent-cyan-500"
                        />
                        <span>
                          I acknowledge the application requirements and consent to the review and status updates associated with this rental application.
                        </span>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-400">Protected backend contract</p>
                      <ul className="space-y-2 text-sm text-slate-200">
                        {appFormSnapshot.map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-5">
                  <button
                    type="button"
                    onClick={() => setStep((current) => Math.max(1, current - 1))}
                    disabled={step === 1}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Back
                  </button>

                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={() => setStep((current) => Math.min(3, current + 1))}
                      className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:brightness-110"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSubmitted(true)}
                      className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:brightness-110"
                    >
                      Submit application
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Guardrails</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Protected business rules</h3>
              <ul className="mt-5 space-y-3">
                {contractGuardrails.map((item) => (
                  <li key={item} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                    <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-300">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Lifecycle</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Status progression</h3>
              <div className="mt-5 flex flex-wrap gap-2">
                {statusStates.map((state) => (
                  <span key={state.label} className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${state.tone}`}>
                    {state.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Migration</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Current phase plan</h3>
              <div className="mt-5 space-y-3">
                {migrationPhases.map((phase) => (
                  <div key={phase.name} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-cyan-300">{phase.name}</span>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{phase.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Protected flow</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Application journey</h3>
            <div className="mt-5 space-y-3">
              {protectedFlow.map((stepName, index) => (
                <div key={stepName} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-semibold text-cyan-200">
                    {index + 1}
                  </div>
                  <span className="text-sm text-slate-200">{stepName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Regression matrix</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Business process verification</h3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Step</th>
                    <th className="px-3 py-2 font-medium">Backend dependency</th>
                    <th className="px-3 py-2 font-medium">Must preserve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {regressionMatrix.map((row) => (
                    <tr key={row.step}>
                      <td className="px-3 py-2 text-slate-100">{row.step}</td>
                      <td className="px-3 py-2 text-slate-300">{row.backend}</td>
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

        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Route map</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Legacy route → migration target</h3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-300">
                  <tr>
                    <th className="px-3 py-2 font-medium">Route</th>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {routeMigrationMap.map((item) => (
                    <tr key={item.route}>
                      <td className="px-3 py-2 text-slate-100">{item.route}</td>
                      <td className="px-3 py-2 text-slate-300">{item.target}</td>
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

          <div className="rounded-[24px] border border-slate-800 bg-slate-900 p-6">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Auth/session compatibility</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Protected session contract</h3>
            <ul className="mt-5 space-y-3">
              {authProtections.map((item) => (
                <li key={item} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-300">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
