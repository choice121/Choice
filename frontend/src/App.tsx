const protectedFlow = [
  'Property selection',
  'Application start',
  'Application form',
  'Submission',
  'Review',
  'Approval / denial',
  'Lease workflow',
  'Tenant onboarding',
]

const migrationPhases = [
  { name: 'Phase 0', detail: 'Baseline capture and rollback guardrails' },
  { name: 'Phase 1', detail: 'Architecture and route map' },
  { name: 'Phase 2', detail: 'Design system and shared shell' },
  { name: 'Phase 3', detail: 'Protected application slice migration' },
  { name: 'Phase 4', detail: 'Approval, lease and tenant flows' },
  { name: 'Phase 5', detail: 'Regression validation and production cutover' },
]

const contractGuardrails = [
  'Keep Supabase as the system of record',
  'Preserve edge-function validation and status transitions',
  'Do not rewrite business logic during UI modernization',
  'Route-by-route migration with legacy fallback',
]

function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <header className="mb-10 rounded-3xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Choice Properties — migration baseline
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Protect the business process. Modernize the experience.
              </h1>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              Protected flow: <span className="font-semibold">UI can change</span> · <span className="font-semibold">business logic stays fixed</span>
            </div>
          </div>
        </header>

        <section className="mb-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Architecture</p>
            <p className="mt-3 text-2xl font-semibold text-white">React + Vite + TS</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Design system</p>
            <p className="mt-3 text-2xl font-semibold text-white">Tailwind + shadcn</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Backend</p>
            <p className="mt-3 text-2xl font-semibold text-white">Supabase first</p>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">Protected rental application flow</h2>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                business-critical
              </span>
            </div>

            <div className="space-y-4">
              {protectedFlow.map((step, index) => (
                <div key={step} className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-sm font-semibold text-cyan-200">
                    {index + 1}
                  </div>
                  <div className="flex-1 text-sm text-slate-200">{step}</div>
                  {index < protectedFlow.length - 1 && (
                    <div className="hidden text-slate-500 md:block">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-5 text-xl font-semibold text-white">Migration guardrails</h2>
            <ul className="space-y-3">
              {contractGuardrails.map((item) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
                  <span className="mt-0.5 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-white">Migration phases</h2>
            <span className="text-sm text-slate-400">baseline-first, route-by-route</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {migrationPhases.map((phase) => (
              <div key={phase.name} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{phase.name}</p>
                <p className="mt-3 text-base font-medium text-white">{phase.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-semibold text-white">Current backend contracts to preserve</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">Application intake</p>
              <p className="mt-2">Server-side validation, dedupe, file uploads, consent logging, portal link generation</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">Auth/session</p>
              <p className="mt-2">Supabase auth, PKCE, access token refresh, and session persistence behavior</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">Review and approval</p>
              <p className="mt-2">Status transitions, landlord/admin visibility, and downstream leasing logic</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">Lease and onboarding</p>
              <p className="mt-2">Document generation, signing, tenant access, and onboarding progression</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
