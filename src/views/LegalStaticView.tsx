import React from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  HelpCircle, 
  FileText, 
  DollarSign, 
  PawPrint, 
  Building, 
  ArrowRight,
  Lock,
  Heart
} from 'lucide-react';

interface LegalStaticViewProps {
  type: string;
  onNavigate: (view: string, param?: string) => void;
}

export const LegalStaticView: React.FC<LegalStaticViewProps> = ({ type, onNavigate }) => {
  if (type === 'how-to-apply') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Applicant Guidelines
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            How to Apply for a Rental Home
          </h1>
          <p className="text-sm text-slate-500 max-w-xl mx-auto">
            Our straightforward 4-step application process ensures swift verification and transparent approval within 24 to 48 hours.
          </p>
        </div>

        {/* 4 Steps Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 font-extrabold text-base flex items-center justify-center">
              1
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Choose Your Property</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Explore our verified marketplace across top US metros. Schedule an in-person tour or proceed directly to online application.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 font-extrabold text-base flex items-center justify-center">
              2
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Submit 6-Step Digital Form</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Complete your encrypted application online. Provide employment history, landlord references, and pet information.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 font-extrabold text-base flex items-center justify-center">
              3
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">$50 Application Screening Fee</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Fixed $50 fee per adult applicant covering credit, background, prior eviction history, and income verification.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 font-extrabold text-base flex items-center justify-center">
              4
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Lease Signing & Move-In</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Upon approval, e-sign your lease contract, submit the 1x monthly rent security deposit, and receive your digital move-in key code.
            </p>
          </div>
        </div>

        {/* Qualification Standards */}
        <div className="p-8 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="font-bold text-base text-slate-900 dark:text-white">Standard Qualification Criteria</h3>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Income Requirement:</strong> Verifiable gross household income of at least 3x monthly rent.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Credit & Background:</strong> Positive payment history with no open bankruptcies or recent evictions.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Security Deposit:</strong> Standard 1x monthly rent due at lease signing.</span>
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span><strong>Pet Policy:</strong> Pet-friendly living across all homes.</span>
            </li>
          </ul>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => onNavigate('apply')}
            className="px-8 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all active:scale-95"
          >
            Start Rental Application ($50)
          </button>
        </div>
      </div>
    );
  }

  if (type === 'faq') {
    const faqs = [
      {
        q: 'How much is the application fee?',
        a: 'The application fee is strictly $50 per adult applicant (18 years or older). It covers all comprehensive background, credit, eviction, and income screening reports.',
      },
      {
        q: 'What is the required security deposit?',
        a: 'The standard security deposit is equal to exactly 1 month of rent (1x monthly rent). It is held in an insured escrow account and refundable in accordance with state tenant laws.',
      },
      {
        q: 'Are all Choice Properties pet-friendly?',
        a: 'Yes! All Choice Properties homes welcome pets. We require basic pet details during the application.',
      },
      {
        q: 'How long does the application review take?',
        a: 'Most applications are completely processed and reviewed within 24 to 48 hours after all required documents and references are verified.',
      },
      {
        q: 'Can I track my application status online?',
        a: 'Yes! You can use our Applicant Portal anytime with your unique Application Tracking ID or email address.',
      },
    ];

    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
            Frequently Asked Questions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Find quick answers about leasing, screening criteria, fees, and move-in procedures.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((f, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span>{f.q}</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 pl-6 leading-relaxed">
                {f.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback for Fair Housing / Policies
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6 text-slate-700 dark:text-slate-300">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white capitalize">
          {type.replace(/-/g, ' ')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">Choice Properties LLC Legal & Compliance Policies</p>
      </div>

      <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm space-y-4 leading-relaxed">
        <p>
          Choice Properties LLC is committed to full compliance with the Federal Fair Housing Act (Title VIII of the Civil Rights Act of 1968, as amended) and all state and municipal human rights regulations.
        </p>
        <p>
          We do not discriminate on the basis of race, color, national origin, religion, sex, familial status, disability, marital status, sexual orientation, source of legal income, or any other protected class.
        </p>
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <h4 className="font-bold text-slate-900 dark:text-white">Key Tenancy Directives:</h4>
          <ul className="list-disc pl-5 space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <li>Application fee is fixed at $50 per adult applicant.</li>
            <li>Security deposit is 1x monthly rent.</li>
            <li>Properties maintain pet-friendly policies across all markets.</li>
            <li>Encrypted digital processing protects all sensitive applicant data.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
